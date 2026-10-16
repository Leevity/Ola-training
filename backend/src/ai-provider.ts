import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Database, Queryable } from './db.ts';
import type { Config } from './config.ts';
import { requireAdmin, requireTenant } from './auth.ts';
import { HttpError, bad } from './errors.ts';
import { mutate } from './store.ts';

const providerInput=z.object({baseUrl:z.string().url().max(500),model:z.string().trim().min(1).max(200),apiKey:z.string().trim().min(1).max(4096).optional()});
type Provider={baseUrl:string;model:string;apiKey:string};

async function encryptionKey(config:Config){
 if(config.aiEncryptionKey)return Buffer.from(config.aiEncryptionKey,'hex');
 if(config.production)throw new HttpError(503,'AI_KEY_NOT_CONFIGURED','请先设置服务端 AI_CONFIG_ENCRYPTION_KEY');
 await mkdir(config.dataDir,{recursive:true});
 const path=join(config.dataDir,'ai-encryption-key');
 try{await writeFile(path,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
 const encoded=(await readFile(path,'utf8')).trim();
 if(!/^[a-fA-F0-9]{64}$/.test(encoded))throw new Error('Invalid stored AI encryption key');
 return Buffer.from(encoded,'hex');
}
async function seal(config:Config,tenantId:string,value:string){
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',await encryptionKey(config),nonce);
 cipher.setAAD(Buffer.from(tenantId));
 const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 return [nonce,cipher.getAuthTag(),ciphertext].map(v=>v.toString('base64url')).join('.');
}
async function unseal(config:Config,tenantId:string,value:string){
 try{const [nonce,tag,encrypted]=value.split('.').map(v=>Buffer.from(v,'base64url'));
 const cipher=createDecipheriv('aes-256-gcm',await encryptionKey(config),nonce);cipher.setAAD(Buffer.from(tenantId));cipher.setAuthTag(tag);
 return Buffer.concat([cipher.update(encrypted),cipher.final()]).toString('utf8');
 }catch(e){if(e instanceof HttpError)throw e;throw new HttpError(503,'AI_KEY_UNAVAILABLE','模型密钥无法解密，请检查服务端加密密钥或重新保存配置');}
}
function validateUrl(input:string,production:boolean){
 const url=new URL(input);
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw bad('模型地址须为无账号、查询参数和片段的 HTTP(S) 地址');
 if(production&&url.protocol!=='https:')throw bad('生产环境模型地址必须使用 HTTPS');
 return url.toString().replace(/\/$/,'');
}
function publicAddress(address:string):boolean {
 if(isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19)||a>=224);}
 const lower=address.toLowerCase();
 // IPv4-mapped, link-local, unique-local and multicast addresses are not public model endpoints.
 return isIP(address)===6&&!lower.startsWith('::')&&!lower.startsWith('fc')&&!lower.startsWith('fd')&&!lower.startsWith('fe')&&!lower.startsWith('ff');
}

/** OpenAI-compatible transport. DNS address is pinned to the request; redirects are never followed. */
export async function callModel(config:Config,provider:Provider,system:string,user:string,options:{maxOutputTokens?:number}={}):Promise<string>{
 if(options.maxOutputTokens!==undefined&&(!Number.isInteger(options.maxOutputTokens)||options.maxOutputTokens<128||options.maxOutputTokens>16384))throw bad('模型输出额度须为128–16384整数');
 const base=validateUrl(provider.baseUrl,config.production),url=new URL(base+'/chat/completions');
 const hostname=url.hostname.replace(/^\[|\]$/g,'');
 let addresses;try{addresses=isIP(hostname)?[{address:hostname,family:isIP(hostname)}]:await lookup(hostname,{all:true});}catch{throw new HttpError(502,'AI_CONNECTION_FAILED','模型地址无法解析');}
 if(!addresses.length||config.production&&addresses.some(a=>!publicAddress(a.address)))throw bad('生产环境模型地址必须解析为公网地址');
 const pinned=addresses[0];
 const payload=JSON.stringify({model:provider.model,messages:[{role:'system',content:system},{role:'user',content:user}],stream:false,...(options.maxOutputTokens===undefined?{}:{max_tokens:options.maxOutputTokens})});
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(error:Error|null,value?:string)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value!);};
  const request=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{method:'POST',headers:{authorization:`Bearer ${provider.apiKey}`,'content-type':'application/json','content-length':Buffer.byteLength(payload)},lookup:((_host:any,options:any,callback:any)=>options.all?callback(null,[pinned]):callback(null,pinned.address,pinned.family)) as any},response=>{
   const chunks:Buffer[]=[];let size=0;
   response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>2*1024*1024){finish(new HttpError(502,'AI_RESPONSE_TOO_LARGE','模型响应超过限制'));response.destroy();request.destroy();}else chunks.push(chunk);});
   response.on('error',()=>finish(new HttpError(502,'AI_CONNECTION_FAILED','模型响应中断')));
   response.on('end',()=>{
    if(response.statusCode===401||response.statusCode===403)return finish(new HttpError(502,'AI_AUTH_FAILED','模型服务认证失败，请检查模型密钥及该模型的使用权限后重试。'));
    if(response.statusCode===429)return finish(new HttpError(503,'AI_RATE_LIMITED','模型服务请求过于频繁或额度不足，请检查供应商额度，稍后手动重试。'));
    if(response.statusCode!==undefined&&response.statusCode>=500)return finish(new HttpError(503,'AI_UPSTREAM_UNAVAILABLE','模型服务暂时不可用，请稍后手动重试。'));
    if(response.statusCode!==200)return finish(new HttpError(502,'AI_UPSTREAM_ERROR',`模型服务请求失败（${response.statusCode}），请检查服务地址和模型名称。`));
    let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return finish(new HttpError(502,'AI_INVALID_RESPONSE','模型未返回有效文本内容'));}
    const choice=value?.choices?.[0];
    if(choice?.finish_reason==='length')return finish(new HttpError(502,'AI_OUTPUT_TRUNCATED','模型输出达到长度上限，未完整生成。请减少单场景内容或调整模型服务的输出额度后重试。'));
    if(choice?.finish_reason==='content_filter')return finish(new HttpError(502,'AI_OUTPUT_FILTERED','模型服务未允许生成当前内容，请调整课程要求后重试。'));
    const content=choice?.message?.content;if(typeof content!=='string'||!content.trim())return finish(new HttpError(502,'AI_INVALID_RESPONSE','模型未返回有效文本内容'));finish(null,content);
   });
  });
  const timer=setTimeout(()=>{finish(new HttpError(504,'AI_TIMEOUT','模型服务响应超时，请稍后手动重试'));request.destroy();},config.aiRequestTimeoutMs??90000);
  request.on('error',()=>finish(new HttpError(502,'AI_CONNECTION_FAILED','无法连接模型服务')));
  request.end(payload);
 });
}
export async function loadProvider(db:Queryable,config:Config,tenantId:string):Promise<Provider>{
 const row=(await db.query('SELECT * FROM ai_provider_settings WHERE tenant_id=$1',[tenantId])).rows[0];
 if(!row)throw new HttpError(503,'AI_NOT_CONFIGURED','请先在管理端配置模型服务');
 return {baseUrl:row.base_url,model:row.model,apiKey:await unseal(config,tenantId,row.encrypted_key)};
}
export async function registerAIProvider(app:FastifyInstance,db:Database,config:Config){
 const path='/api/tenants/:tenantId/ai/provider';
 app.get(path,async req=>{const a=requireTenant(req);requireAdmin(a);const row=(await db.query('SELECT base_url,model,updated_at FROM ai_provider_settings WHERE tenant_id=$1',[a.tenantId])).rows[0];return row?{configured:true,baseUrl:row.base_url,model:row.model,hasKey:true,updatedAt:row.updated_at}:{configured:false,baseUrl:'',model:'',hasKey:false};});
 app.put(path,async req=>{
  const a=requireTenant(req);requireAdmin(a);const input=providerInput.parse(req.body);const baseUrl=validateUrl(input.baseUrl,config.production);
  await mutate(db,a,req.headers['if-match'],'更新模型服务配置','AI 模型服务',async tx=>{
   const prior=(await tx.query('SELECT encrypted_key,base_url FROM ai_provider_settings WHERE tenant_id=$1',[a.tenantId])).rows[0];
   if(!input.apiKey&&!prior)throw bad('首次配置须填写模型密钥');
   if(!input.apiKey&&prior.base_url!==baseUrl)throw bad('更换服务地址时须重新填写密钥');
   const encrypted=input.apiKey?await seal(config,a.tenantId,input.apiKey):prior.encrypted_key;
   await tx.query('INSERT INTO ai_provider_settings(tenant_id,base_url,model,encrypted_key) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id) DO UPDATE SET base_url=excluded.base_url,model=excluded.model,encrypted_key=excluded.encrypted_key,updated_at=now()',[a.tenantId,baseUrl,input.model,encrypted]);
  });
  return {saved:true};
 });
 app.post(path+'/test',async req=>{
  const a=requireTenant(req);requireAdmin(a);const provider=await loadProvider(db,config,a.tenantId);const started=Date.now();
  await callModel(config,provider,'This is a connectivity check. Reply with OK.','Reply with OK.');
  return {connected:true,model:provider.model,latencyMs:Date.now()-started};
 });
}
