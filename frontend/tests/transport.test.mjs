import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LearnerTransport} from '../../packages/learner-client/src/transport.ts';
const user={id:'account-a',tenantId:'enterprise-a',memberId:'member-a'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});

for(const [status,code,sameAccount] of [[401,'SESSION_EXPIRED',false],[403,'SESSION_CHANGED',false],[401,'SESSION_EXPIRED',true]])test(`旧会话迟到的${code}不清除已经更新的${sameAccount?'同账号':'新企业'}会话`,async()=>{
 let release,expired=0;const gate=new Promise(resolve=>{release=resolve;});
 const transport=new LearnerTransport({fetch:async()=>{await gate;return json({error:{code}},status);},onExpired:()=>expired++});
 transport.setSession(user,'old');const pending=assert.rejects(transport.request('/learn/overview'),error=>error.code===code);
 const next=sameAccount?user:{...user,tenantId:'enterprise-b',memberId:'member-b'};transport.setSession(next,'new');release();await pending;
 assert.equal(expired,0);assert.equal(transport.csrf,'new');assert.equal(transport.context,`${next.id}:${next.tenantId}:${next.memberId}`);
});

for(const stage of ['refused','recovery-401','recovery-success'])test(`企业切换时旧CSRF恢复${stage}不重放写入、不覆盖新会话`,async()=>{
 let release,expired=0,calls=0;const gate=new Promise(resolve=>{release=resolve;});
 const transport=new LearnerTransport({fetch:async()=>{
  calls++;
  if(calls===1){if(stage==='refused')await gate;return json({error:{code:'CSRF_REFUSED'}},403);}
  await gate;return stage==='recovery-401'?json({error:{code:'SESSION_EXPIRED'}},401):json({user,csrf:'stale-recovered'});
 },onExpired:()=>expired++});
 transport.setSession(user,'old');const pending=assert.rejects(transport.request('/learn/progress','POST',{}),error=>error.code==='SESSION_CHANGED');
 if(stage!=='refused'){for(let attempt=0;calls<2&&attempt<20;attempt++)await new Promise(setImmediate);assert.equal(calls,2);}
 const next={...user,tenantId:'enterprise-b',memberId:'member-b'};transport.setSession(next,'new');release();await pending;
 assert.equal(expired,0);assert.equal(transport.csrf,'new');assert.equal(transport.context,'account-a:enterprise-b:member-b');assert.equal(calls,stage==='refused'?1:2);
});

test('网络中断显示可操作中文提示，不自动重放写入或清除有效身份',async()=>{
 let calls=0;const transport=new LearnerTransport({fetch:async()=>{calls++;throw new TypeError('Failed to fetch');},onExpired:()=>assert.fail()});transport.setSession(user,'csrf-a');
 await assert.rejects(transport.request('/learn/progress','POST',{eventId:'same'}),error=>error.code==='NETWORK_ERROR'&&error.status===0&&error.message.includes('请检查网络后重试'));
 assert.equal(calls,1);assert.equal(transport.csrf,'csrf-a');assert.equal(transport.context,'account-a:enterprise-a:member-a');
});

test('学员请求携带当前成员企业上下文和CSRF，me不绑定旧上下文',async()=>{
 const calls=[];const transport=new LearnerTransport({fetch:async(url,options)=>{calls.push({url,options});return json({ok:true});},onExpired:()=>assert.fail()});transport.setSession(user,'csrf-a');
 await transport.request('/learn/progress','POST',{version:1});await transport.request('/auth/me');
 assert.equal(calls[0].options.headers['x-ola-context'],'account-a:enterprise-a:member-a');assert.equal(calls[0].options.headers['x-csrf-token'],'csrf-a');assert.equal(calls[1].options.headers['x-ola-context'],undefined);
});
test('同一身份重新登录可恢复CSRF并仅重试一次被拒绝的请求',async()=>{
 const calls=[];const transport=new LearnerTransport({fetch:async(url,options)=>{calls.push({url,options});if(calls.length===1)return json({error:{code:'CSRF_REFUSED'}},403);if(calls.length===2)return json({user,csrf:'new-csrf'});return json({saved:true});},onExpired:()=>assert.fail()});transport.setSession(user,'old-csrf');
 assert.deepEqual(await transport.request('/learn/progress','POST',{eventId:'same-event'}),{saved:true});assert.equal(calls.length,3);assert.equal(calls[0].options.body,calls[2].options.body);assert.equal(calls[2].options.headers['x-csrf-token'],'new-csrf');
});
test('身份改变时不重放旧页面写入并清理本地会话',async()=>{
 let calls=0,expired=0;const transport=new LearnerTransport({fetch:async()=>{calls++;return calls===1?json({error:{code:'CSRF_REFUSED'}},403):json({user:{...user,id:'different-account'},csrf:'new'});},onExpired:()=>expired++});transport.setSession(user,'old');
 await assert.rejects(transport.request('/learn/progress','POST',{}),error=>error.code==='SESSION_CHANGED');assert.equal(calls,2);assert.equal(expired,1);assert.equal(transport.context,'');assert.equal(transport.csrf,'');
});
test('企业上下文改变和普通权限拒绝均不自动重试',async()=>{
 for(const code of ['SESSION_CHANGED','FORBIDDEN']){let calls=0,expired=0;const transport=new LearnerTransport({fetch:async()=>{calls++;return json({error:{code,message:'denied'}},403);},onExpired:()=>expired++});transport.setSession(user,'old');await assert.rejects(transport.request('/learn/progress','POST',{}));assert.equal(calls,1);assert.equal(expired,code==='SESSION_CHANGED'?1:0);}
});
test('恢复请求自身失效时触发登录失效，不循环重试',async()=>{
 let calls=0,expired=0;const transport=new LearnerTransport({fetch:async()=>{calls++;return calls===1?json({error:{code:'CSRF_REFUSED'}},403):json({error:{code:'SESSION_EXPIRED'}},401);},onExpired:()=>expired++});transport.setSession(user,'old');await assert.rejects(transport.request('/learn/progress','POST',{}));assert.equal(calls,2);assert.equal(expired,1);
});


test('文件响应保持二进制完整，拒绝时仍解析统一权限错误',async()=>{
 const bytes=new Uint8Array([0,255,42,17]);let denied=false;
 const transport=new LearnerTransport({fetch:async()=>denied?json({error:{code:'NOT_FOUND',message:'记录不存在或不可访问'}},404):new Response(bytes,{headers:{'content-disposition':"attachment; filename*=UTF-8''report.docx"}}),onExpired:()=>assert.fail()});transport.setSession(user,'csrf');
 const response=await transport.request('/learn/knowledge/file/download','GET',undefined,'response');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
 denied=true;await assert.rejects(transport.request('/learn/knowledge/file/download','GET',undefined,'response'),error=>error.status===404&&error.code==='NOT_FOUND'&&error.message==='记录不存在或不可访问');
});
test('下载HEAD预检携带成员企业上下文，不消费响应或要求CSRF',async()=>{
 let options;const transport=new LearnerTransport({fetch:async(_,input)=>{options=input;return new Response(null,{headers:{'content-disposition':"attachment; filename*=UTF-8''file.docx"}});},onExpired:()=>assert.fail()});transport.setSession(user,'csrf');const response=await transport.request('/learn/knowledge/file/download','HEAD',undefined,'response');assert.equal(options.headers['x-csrf-token'],undefined);assert.equal(options.headers['x-ola-context'],'account-a:enterprise-a:member-a');assert.equal(response.bodyUsed,false);assert(response.headers.get('content-disposition').includes('file.docx'));
});
