import JSZip from 'jszip';
import type { Readable } from 'node:stream';
import { DOMParser } from '@xmldom/xmldom';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, posix } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Database } from './db.ts';
import type { Config } from './config.ts';
import { id } from './schemas.ts';
import { requireContent, requireTenant } from './auth.ts';
import { bad, conflict, missing } from './errors.ts';
import { getKnowledge, mapKnowledge, mutate } from './store.ts';

type Unit={page:number;text:string};
const MAX_CHARS=500000,MAX_EXPANDED=20*1024*1024;
async function zipText(file:JSZip.JSZipObject):Promise<string>{
 return new Promise((resolve,reject)=>{
  const chunks:Buffer[]=[];let size=0;const stream=file.nodeStream('nodebuffer') as unknown as Readable;
  stream.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>MAX_EXPANDED){stream.destroy();reject(new Error('Office XML 解压内容超过限制'));}else chunks.push(chunk);});
  stream.on('error',reject);stream.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
 });
}
function parseOfficeXml(xml:string){
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('不支持包含外部实体的 XML');
 return new DOMParser({onError:(level)=>{if(level!=='warning')throw new Error('Office XML 格式不正确');}}).parseFromString(xml,'application/xml');
}
function xmlParagraphs(xml:string){
 const document=parseOfficeXml(xml);
 const paragraphs=Array.from(document.getElementsByTagName('*')).filter(n=>n.localName==='p');
 return paragraphs.map(p=>Array.from(p.getElementsByTagName('*')).filter(n=>n.localName==='t').map(n=>n.textContent||'').join('')).filter(Boolean).join('\n');
}
export async function extractMaterial(name:string,buffer:Buffer):Promise<Unit[]>{
 const extension=name.split('.').pop()?.toLowerCase();let units:Unit[]=[];
 if(extension==='txt'||extension==='md')units=[{page:1,text:new TextDecoder('utf-8',{fatal:true}).decode(buffer)}];
 else if(extension==='docx'||extension==='pptx'){
  const archive=await JSZip.loadAsync(buffer,{checkCRC32:false});
  let total=0;
  const readXml=async(path:string)=>{const file=archive.files[path];if(!file||file.dir)throw new Error('Office 文档缺少正文或页面引用无效');const xml=await zipText(file);total+=Buffer.byteLength(xml);if(total>MAX_EXPANDED)throw new Error('Office 文档解压内容超过限制');return xml;};
  let names=['word/document.xml'];
  if(extension==='pptx'){
   const presentation=parseOfficeXml(await readXml('ppt/presentation.xml'));
   const relations=parseOfficeXml(await readXml('ppt/_rels/presentation.xml.rels'));
   const links=new Map<string,string>();
   for(const relation of Array.from(relations.getElementsByTagName('*')).filter(n=>n.localName==='Relationship')){
    if(!relation.getAttribute('Type')?.endsWith('/slide'))continue;
    const key=relation.getAttribute('Id')||'',target=relation.getAttribute('Target')||'';
    if(!key||links.has(key)||relation.getAttribute('TargetMode')==='External'||/[:\\?#]/.test(target))throw new Error('Office 幻灯片引用无效');
    const path=posix.normalize(target.startsWith('/')?target.slice(1):posix.join('ppt',target));
    if(!/^ppt\/slides\/[^/]+\.xml$/.test(path))throw new Error('Office 幻灯片引用无效');
    links.set(key,path);
   }
   const slides=Array.from(presentation.getElementsByTagName('*')).filter(n=>n.localName==='sldId'&&n.parentNode?.nodeName.split(':').pop()==='sldIdLst');
   if(slides.length>500)throw new Error('Office 文档页数超过500页');
   names=slides.map(slide=>{
    const key=Array.from(slide.attributes).find(attribute=>attribute.localName==='id'&&attribute.namespaceURI)?.value;
    const path=key&&links.get(key);if(!path)throw new Error('Office 幻灯片顺序引用缺失');return path;
   });
   if(new Set(names).size!==names.length)throw new Error('Office 幻灯片顺序引用重复');
  }
  if(!names.length||names.length>500)throw new Error('Office 文档缺少正文或页数超过500页');
  for(const [i,path] of names.entries()){units.push({page:i+1,text:xmlParagraphs(await readXml(path))});}
 }else if(extension==='pdf'){
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=getDocument({data:new Uint8Array(buffer),useSystemFonts:false,isEvalSupported:false,useWorkerFetch:false});
  try{const document=await task.promise;if(document.numPages>500)throw new Error('PDF 页数超过500页');let total=0;
   for(let page=1;page<=document.numPages;page++){const item=await document.getPage(page);const content=await item.getTextContent();const text=content.items.map(v=>'str'in v?v.str+('hasEOL'in v&&v.hasEOL?'\n':' '):'').join('').trim();total+=text.length;if(total>MAX_CHARS)throw new Error('文档内容超过50万字符');units.push({page,text});item.cleanup();}
  }finally{await task.destroy();}
 }else throw new Error('不支持的资料类型');
 if(units.reduce((n,u)=>n+u.text.length,0)>MAX_CHARS)throw new Error('文档内容超过50万字符');
 if(!units.some(u=>u.text.trim()))throw new Error('未提取到可用文字；扫描件需先进行 OCR');
 return units;
}
export async function registerMaterialParser(app:FastifyInstance,db:Database,config:Config){
 app.post('/api/tenants/:tenantId/knowledge/:id/parse',async req=>{
  const a=requireTenant(req);requireContent(a);const knowledgeId=id.parse((req.params as any).id),token=randomUUID();
  const claimed=await mutate(db,a,undefined,'解析知识文件',knowledgeId,async tx=>{
   const row=await getKnowledge(tx,a.tenantId,knowledgeId);if(row.status==='archived')throw bad('请先恢复归档资料');
   const result=await tx.query("UPDATE knowledge SET parse_token=$1,parse_started_at=now(),parse_error=NULL WHERE tenant_id=$2 AND id=$3 AND (parse_token IS NULL OR parse_started_at<now()-interval '3 minutes') RETURNING *",[token,a.tenantId,knowledgeId]);
   if(!result.rows.length)throw conflict('资料正在解析，请稍后刷新');return result.rows[0];
  });
  try{
   const buffer=claimed.file_key?await readFile(join(config.dataDir,'files',claimed.file_key)):Buffer.from(claimed.text_content||'');
   const units=await extractMaterial(claimed.name,buffer);const text=units.map(u=>`[第${u.page}页]\n${u.text}`).join('\n\n');
   const result=await db.query("UPDATE knowledge SET text_content=$1,parse_units=$2,parse_token=NULL,parse_error=NULL,status='ready',updated_at=now() WHERE tenant_id=$3 AND id=$4 AND parse_token=$5 AND status<>'archived' RETURNING *",[text,JSON.stringify(units),a.tenantId,knowledgeId,token]);
   if(!result.rows.length)throw missing();return mapKnowledge(result.rows[0]);
  }catch(e){
   const message=e instanceof Error&&/^(Office|PDF|文档|未提取|不支持)/.test(e.message)?e.message:'资料解析失败，请检查文件是否损坏或加密';
   await db.query('UPDATE knowledge SET parse_token=NULL,parse_error=$1 WHERE tenant_id=$2 AND id=$3 AND parse_token=$4',[message,a.tenantId,knowledgeId,token]);throw bad(message);
  }
 });
}
