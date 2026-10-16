import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {callModel} from '../src/ai-provider.ts';
import type {Config} from '../src/config.ts';
const config={production:false,aiRequestTimeoutMs:1000} as Config;

test('模型HTTP故障分类、不回传供应商敏感正文、不自动重试，修复后可再次调用',async()=>{
 let status=401,calls=0;
 const privateBody='fixture-secret-and-private-provider-message';
 const server=createServer((req,res)=>{calls++;req.resume();req.on('end',()=>{res.writeHead(status,{'content-type':'application/json'});res.end(status===200?JSON.stringify({choices:[{message:{content:'OK'}}]}):JSON.stringify({error:{message:privateBody}}));});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const provider={baseUrl:`http://127.0.0.1:${(server.address() as any).port}/v1`,model:'test-only',apiKey:'fixture-only-key'};
 try{
  for(const [http,code,responseStatus] of [[401,'AI_AUTH_FAILED',502],[403,'AI_AUTH_FAILED',502],[429,'AI_RATE_LIMITED',503],[503,'AI_UPSTREAM_UNAVAILABLE',503],[404,'AI_UPSTREAM_ERROR',502]] as const){
   status=http;const prior=calls;
   await assert.rejects(()=>callModel(config,provider,'fixture','fixture'),(error:any)=>{
    assert.equal(error.code,code);assert.equal(error.status,responseStatus);assert(!error.message.includes(privateBody));assert(!error.message.includes(provider.apiKey));return true;
   });
   assert.equal(calls,prior+1,'Transport must issue exactly one request');
  }
  status=200;assert.equal(await callModel(config,provider,'fixture','fixture'),'OK');assert.equal(calls,6);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('模型请求总超时覆盖不返回正文和持续缓慢返回，终止连接且不重试',async()=>{
 for(const trickle of [false,true]){
  let calls=0,closed=false;
  const server=createServer((req,res)=>{calls++;req.resume();const interval=trickle?setInterval(()=>res.write(' '),50):undefined;res.on('close',()=>{closed=true;clearInterval(interval);});});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const provider={baseUrl:`http://127.0.0.1:${(server.address() as any).port}/v1`,model:'test-only',apiKey:'fixture-only-key'};
  try{
   const started=Date.now();await assert.rejects(()=>callModel(config,provider,'fixture','fixture'),(error:any)=>error.code==='AI_TIMEOUT'&&error.status===504);
   assert(Date.now()-started<4000);assert.equal(calls,1);
   await new Promise(resolve=>setTimeout(resolve,30));assert.equal(closed,true);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
 }
});

test('模型非法JSON、空内容与中断响应拒绝，修复后成功',async()=>{
 let mode='json';
 const server=createServer((req,res)=>{req.resume();req.on('end',()=>{if(mode==='drop'){res.writeHead(200,{'content-length':'100'});res.write('{');setTimeout(()=>res.destroy(),10);return;}res.writeHead(200,{'content-type':'application/json'});res.end(mode==='json'?'{invalid':mode==='empty'?'{}':JSON.stringify({choices:[{message:{content:'recovered'}}]}));});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const provider={baseUrl:`http://127.0.0.1:${(server.address() as any).port}/v1`,model:'test-only',apiKey:'fixture-only-key'};
 try{
  for(const entry of ['json','empty','drop']){mode=entry;await assert.rejects(()=>callModel(config,provider,'fixture','fixture'),(error:any)=>error.code===(entry==='drop'?'AI_CONNECTION_FAILED':'AI_INVALID_RESPONSE'));}
  mode='success';assert.equal(await callModel(config,provider,'fixture','fixture'),'recovered');
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
