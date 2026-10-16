import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
const requireUI=createRequire(new URL('../../packages/classroom-ui/package.json',import.meta.url));
const {JSDOM}=requireUI('jsdom');
// Cross-project tsx imports may use the classic JSX transform; keep the same React runtime.
globalThis.React=React;

async function fixture(client,{expired=false,conflict=false,responseLost=false,confirmationUnavailable=false}={}){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/#/exam/fixture'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.HTMLElement=dom.window.HTMLElement;
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 dom.window.HTMLElement.prototype.getClientRects=function(){return [new dom.window.DOMRect(0,0,100,40)];};
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const originalFetch=globalThis.fetch;let submits=0,puts=0;
 const attempt={id:'fixture',courseId:'course',version:1,status:'active',answersRevision:0,answers:{},startedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+(expired?-1000:60000)).toISOString(),serverNow:new Date().toISOString(),paper:{passScore:80,questions:[{id:'q',type:'single',title:'虚构案例：应先确认需求吗？',points:100,options:[{id:'A',text:'先确认需求'},{id:'B',text:'直接推荐'}]}]}};
 const data={attempts:[{...attempt,title:'异常流程验收'}],courses:[{id:'course',version:1,kind:'exam',title:'异常流程验收',examAttempts:3,lessons:[]}],progress:[],trainings:[],tasks:[]};
 globalThis.fetch=async(path,init={})=>{
  const method=init.method||'GET';assert.match(String(path),/\/api\/learn\/attempts\/fixture(?:\/answers|\/submit)?$/);
  if(method==='GET'){
   if(confirmationUnavailable&&submits===1)throw new TypeError('Failed to fetch');
   return Response.json(attempt);
  }
  if(String(path).endsWith('/answers')){puts++;const input=JSON.parse(init.body);attempt.answers=input.answers;attempt.answersRevision++;return Response.json({revision:attempt.answersRevision});}
  submits++;
  if(submits===1){
   if(conflict){attempt.answers={q:['B']};attempt.answersRevision=2;return Response.json({error:{code:'ANSWER_CONFLICT',message:'答卷已在另一设备更新，请重新加载'}},{status:409});}
   if(responseLost){attempt.status='pending_review';attempt.objectiveScore=0;}
   throw new Error('模拟断网：交卷未完成');
  }
  attempt.status='graded';attempt.score=0;attempt.passed=false;return Response.json(attempt);
 };
 const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 let Component,Context;
 if(client==='pc'){Component=(await import('../src/workflows.tsx')).ExamPage;Context=(await import('../src/context.tsx')).PortalContext;}
 else{Component=(await import('../../frontend/src/exam-page.tsx')).ExamPage;Context=(await import('../../frontend/src/portal-context.ts')).Context;}
 const portal={data,refresh:async()=>data,go(){},notify(){},user:{id:'demo'},session:{user:{id:'demo'},tenants:[]}};
 await act(async()=>root.render(React.createElement(Context.Provider,{value:portal},React.createElement(Component,{id:'fixture',go(){},back(){}}))));
 await act(async()=>{await new Promise(setImmediate);});
 const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===text);
 return {dom,button,get submits(){return submits;},get puts(){return puts;},close:async()=>{await act(async()=>root.unmount());dom.window.close();globalThis.fetch=originalFetch;}};
}

for(const client of ['pc','h5']){
 test(`${client} 交卷和结果确认同时断网时保留失败入口，不自动重放写入`,async()=>{
  const f=await fixture(client,{confirmationUnavailable:true});
  try{
   await act(async()=>f.button(client==='pc'?'提交答卷':'提交试卷').click());
   await act(async()=>f.button(client==='pc'?'确认提交':'确认交卷').click());
   assert.equal(f.submits,1);assert.match(document.body.textContent,/连接中断/);
   assert.ok(f.button('重试交卷'));
   await act(async()=>f.button('重试交卷').click());await act(async()=>{await new Promise(setImmediate);});
   assert.equal(f.submits,2);assert.equal(document.querySelector('input[type="radio"]'),null);
  }finally{await f.close();}
 });
 test(`${client} 交卷响应丢失后只读核对已提交结果，不重复交卷`,async()=>{
  const f=await fixture(client,{responseLost:true});
  try{
   await act(async()=>f.button(client==='pc'?'提交答卷':'提交试卷').click());
   await act(async()=>f.button(client==='pc'?'确认提交':'确认交卷').click());
   assert.equal(f.submits,1);assert.match(document.body.textContent,/待.*阅卷/);
   assert.equal(document.querySelector('input[type="radio"]'),null);
   assert.doesNotMatch(document.body.textContent,/连接中断/);
  }finally{await f.close();}
 });
 test(`${client} 手动交卷网络失败持续显示提示并可重试`,async()=>{
  const f=await fixture(client);
  try{
   await act(async()=>f.button(client==='pc'?'提交答卷':'提交试卷').click());
   await act(async()=>f.button(client==='pc'?'确认提交':'确认交卷').click());
   assert.equal(f.submits,1);assert.match(document.body.textContent,/连接中断，请检查网络后重试/);
   const retry=f.button('重试交卷');assert.ok(retry);
   await act(async()=>retry.click());await act(async()=>{await new Promise(setImmediate);});
   assert.equal(f.submits,2);assert.equal(document.querySelector('input[type="radio"]'),null);
  }finally{await f.close();}
 });
 test(`${client} 到时自动交卷失败持续显示恢复入口，重试成功前禁止改答案`,async()=>{
  const f=await fixture(client,{expired:true});
  try{
   assert.equal(f.submits,1);assert.match(document.body.textContent,/连接中断，请检查网络后重试/);
   assert.equal(document.querySelector('fieldset').disabled,true);
   assert.equal(f.puts,0,'到时不能把未保存答案补写为正式作答');
   const retry=f.button(client==='pc'?'重新提交已保存的答案':'提交已保存的答案');assert.ok(retry);assert.equal(retry.disabled,false);
   await act(async()=>retry.click());await act(async()=>{await new Promise(setImmediate);});
   assert.equal(f.submits,2);assert.doesNotMatch(document.body.textContent,/模拟断网/);assert.equal(document.querySelector('input[type="radio"]'),null);assert.equal(f.puts,0);
  }finally{await f.close();}
 });
 test(`${client} 交卷冲突会锁定编辑，明确重载并恢复远端答卷`,async()=>{
  const f=await fixture(client,{conflict:true});
  try{
   await act(async()=>f.button(client==='pc'?'提交答卷':'提交试卷').click());
   await act(async()=>f.button(client==='pc'?'确认提交':'确认交卷').click());
   assert.equal(f.submits,1);assert.match(document.body.textContent,/另一设备更新/);assert.equal(document.querySelector('fieldset').disabled,true);
   const reload=f.button('放弃本地更改并加载服务端答卷');assert.ok(reload);
   await act(async()=>reload.click());await act(async()=>{await new Promise(setImmediate);});
   assert.doesNotMatch(document.body.textContent,/另一设备更新/);assert.equal(document.querySelector('fieldset').disabled,false);
   const options=[...document.querySelectorAll('input[type="radio"]')];assert.equal(options[1].checked,true);
  }finally{await f.close();}
 });
}
