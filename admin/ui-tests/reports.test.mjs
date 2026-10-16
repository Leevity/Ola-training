import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
const {JSDOM}=createRequire(new URL('../../packages/classroom-ui/package.json',import.meta.url))('jsdom');
globalThis.React=React;
const fail=()=>Response.json({error:{code:'QA_UNAVAILABLE',message:'模拟连接失败'}},{status:503});
async function harness(handler){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const prior=globalThis.fetch;globalThis.fetch=async(path,...args)=>path==='/api/auth/me'?Response.json({user:{id:'qa',tenantId:'qa',memberId:'m'},csrf:'fixture-only-csrf'}):handler(path,...args);
 await (await import('../src/api.ts')).me();const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 return {dom,root,button:name=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===name),close:async()=>{await act(async()=>root.unmount());dom.window.close();globalThis.fetch=prior;}};
}
const task={id:'t',title:'验收任务',status:'published'};
const report=(name,total=31)=>({total,completed:0,items:[{memberId:name,name,employeeNo:'QA-1',department:'验收部',completedCourses:0,totalCourses:1,completed:false,lastActivity:null,stages:[]} ]});
test('报告失败不展示旧页；重试保留页码、等待不重复翻页，摘要失败只读重连，导出失败保留明细',async()=>{
 let reads=0,syncs=0,exports=0,release;
 const h=await harness(async path=>{
  if(path.endsWith('/export')){exports++;return fail();}
  assert.match(path,/reports\/tasks\/t\?limit=30&offset=(0|30)$/);reads++;
  if(reads===1)return fail();
  if(reads===3)return new Promise(ok=>release=ok);
  return Response.json(report(path.endsWith('offset=30')?'第二页成员':'第一页成员'));
 });
 const {TaskReportPanel}=await import('../src/task-report-panel.tsx');
 try{
  await act(async()=>h.root.render(React.createElement(TaskReportPanel,{tasks:[task],onDataRefresh:async()=>{if(++syncs===1)throw new Error('摘要失败');}})));
  assert.match(document.body.textContent,/学习明细读取失败/);assert.equal(document.querySelector('table'),null);
  await act(async()=>h.button('重试读取明细').click());assert.equal(reads,2);assert.match(document.body.textContent,/第一页成员/);assert.match(document.body.textContent,/明细已读取，但任务摘要同步失败/);
  await act(async()=>{h.button('重试同步任务摘要').click();h.button('重试同步任务摘要')?.click();});assert.equal(reads,2);assert.equal(syncs,2);assert.equal(h.button('重试同步任务摘要'),undefined);
  await act(async()=>h.button('下一页').click());assert.equal(reads,3);assert.match(document.body.textContent,/正在读取成员学习记录/);assert.equal(document.querySelector('table'),null);assert.equal(h.button('下一页'),undefined);
  await act(async()=>release(fail()));assert.match(document.body.textContent,/学习明细读取失败/);assert.doesNotMatch(document.body.textContent,/第一页成员/);assert.ok(h.button('返回第一页'));
  await act(async()=>h.button('重试读取明细').click());assert.equal(reads,4);assert.match(document.body.textContent,/第二页成员/);assert.match(document.body.textContent,/第 31–31 条/);assert.equal(document.activeElement,document.querySelector('section'));
  await act(async()=>{h.button('导出任务学习明细').click();h.button('导出任务学习明细').click();});assert.equal(exports,1);assert.match(document.body.textContent,/导出失败/);assert.match(document.body.textContent,/第二页成员/);
  await act(async()=>h.root.render(React.createElement(TaskReportPanel,{tasks:[]})));assert.equal(document.querySelector('select').value,'');assert.match(document.body.textContent,/暂无可查看的任务/);assert.equal(document.querySelector('table'),null);
 }finally{await h.close();}
});
test('切换任务后的迟到旧响应不能覆盖当前报告，归档任务可直接读取',async()=>{
 let resolveOld;
 const h=await harness(path=>path.includes('/tasks/t?')?new Promise(ok=>resolveOld=ok):Response.json(report('当前归档任务成员',1)));
 const {TaskReportPanel}=await import('../src/task-report-panel.tsx');
 try{
  await act(async()=>h.root.render(React.createElement(TaskReportPanel,{tasks:[task,{id:'archived',title:'归档任务',status:'archived'}]})));
  await act(async()=>{const select=document.querySelector('select');select.value='archived';select.dispatchEvent(new h.dom.window.Event('change',{bubbles:true}));});
  await act(async()=>resolveOld(Response.json(report('迟到旧成员'))));assert.match(document.body.textContent,/当前归档任务成员/);assert.doesNotMatch(document.body.textContent,/迟到旧成员/);
  await act(async()=>h.root.render(React.createElement(TaskReportPanel,{key:'archive-only',tasks:[{id:'archived',title:'归档任务',status:'archived'}]})));assert.match(document.body.textContent,/当前归档任务成员/);
 }finally{await h.close();}
});
test('待评读取失败区别于空列表，详情失败留在弹窗重试，关闭后迟到响应不会重开',async()=>{
 let queueReads=0,detailReads=0,releaseDetail,releaseRetry;
 const row={id:'r',member_name:'虚构学员',course_title:'验收训练',course_version:1,created_at:'2026-10-17T00:00:00Z'};
 const h=await harness(path=>{
  if(path.includes('/training?'))return ++queueReads===1?fail():Response.json({items:[row]});
  if(path.endsWith('/training/r')){detailReads++;if(detailReads===1)return fail();if(detailReads===3)return new Promise(ok=>releaseDetail=ok);return new Promise(ok=>releaseRetry=ok);}
  if(path.includes('/exam-attempts?'))return Response.json({items:[]});
  assert.fail(path);
 });
 const {ReviewPanel}=await import('../src/review-panel.tsx');
 try{
  await act(async()=>h.root.render(React.createElement(ReviewPanel,{onDataRefresh:async()=>{}})));assert.match(document.body.textContent,/待评记录读取失败/);assert.doesNotMatch(document.body.textContent,/暂无待评记录/);
  await act(async()=>h.button('重试读取待评').click());assert.equal(queueReads,2);assert.match(document.body.textContent,/虚构学员/);assert.equal(document.activeElement,document.querySelector('section'));
  const entry=h.button('查看并评价');entry.focus();await act(async()=>entry.click());assert.match(document.querySelector('[role="dialog"]').textContent,/评价记录读取失败/);assert.ok(h.button('重试读取作答'));
  await act(async()=>h.button('重试读取作答').click());assert.equal(detailReads,2);assert.equal(document.activeElement,document.querySelector('[role="dialog"]'));await act(async()=>releaseRetry(Response.json({record:{id:'r',status:'pending_review',course_version:1,course_content:{title:'验收训练'}},messages:[]})));assert.match(document.querySelector('[role="dialog"]').textContent,/训练分数/);
  await act(async()=>h.button('取消').click());assert.equal(document.querySelector('[role="dialog"]'),null);
  await act(async()=>h.button('查看并评价').click());assert.match(document.querySelector('[role="dialog"]').textContent,/正在读取学员作答/);
  await act(async()=>h.button('取消').click());await act(async()=>releaseDetail(Response.json({record:{id:'r'},messages:[]})));assert.equal(document.querySelector('[role="dialog"]'),null);
  await act(async()=>{const select=document.querySelector('select');select.value='exam-attempts';select.dispatchEvent(new h.dom.window.Event('change',{bubbles:true}));});assert.match(document.body.textContent,/暂无待评记录/);assert.equal(document.querySelector('[role="alert"]'),null);
 }finally{await h.close();}
});
test('评价未保存关闭可继续；等待阻止重复保存，失败保留输入，成功后的摘要重试不再评价',async()=>{
 let writes=0,syncs=0,resolveSave,graded=false;
 const row={id:'r',member_name:'虚构学员',course_title:'验收训练',course_version:1,created_at:'2026-10-17T00:00:00Z'};
 const h=await harness((path,options)=>{
  if(path.includes('/training?'))return Response.json({items:graded?[]:[row]});
  if(path.endsWith('/training/r'))return Response.json({record:{id:'r',status:'pending_review',course_version:1,course_content:{title:'验收训练'}},messages:[]});
  if(path.endsWith('/training/r/review')){assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{score:85,feedback:'表达清晰，建议继续补充需求确认。',passed:false});if(++writes===1)return new Promise(ok=>resolveSave=ok);graded=true;return Response.json({ok:true});}
  assert.fail(path);
 });
 const {ReviewPanel}=await import('../src/review-panel.tsx');
 try{
  await act(async()=>h.root.render(React.createElement(ReviewPanel,{onDataRefresh:async()=>{if(++syncs===1)throw new Error('摘要读取失败');}})));
  await act(async()=>h.button('查看并评价').click());
  await act(async()=>{const input=document.querySelector('input[aria-label="训练分数"]'),area=document.querySelector('textarea');Object.getOwnPropertyDescriptor(h.dom.window.HTMLInputElement.prototype,'value').set.call(input,'85');input.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));Object.getOwnPropertyDescriptor(h.dom.window.HTMLTextAreaElement.prototype,'value').set.call(area,'表达清晰，建议继续补充需求确认。');area.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));});
  await act(async()=>h.button('取消').click());assert.ok(h.button('继续评价'));assert.equal(document.querySelector('fieldset').disabled,true);assert.equal(document.activeElement,h.button('继续评价'));
  await act(async()=>h.button('继续评价').click());assert.equal(document.querySelector('input').value,'85');assert.equal(document.activeElement,document.querySelector('input'));
  await act(async()=>{h.button('确认并保存评价').click();h.button('确认并保存评价')?.click();});assert.equal(writes,1);assert.equal(document.querySelector('button[aria-label="关闭弹窗"]').disabled,true);assert.equal(document.querySelector('input').disabled,true);assert.equal(document.activeElement,document.querySelector('[role="dialog"]'));
  await act(async()=>document.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.ok(document.querySelector('[role="dialog"]'));
  await act(async()=>resolveSave(fail()));assert.match(document.querySelector('[role="alert"]').textContent,/模拟连接失败/);assert.equal(document.querySelector('textarea').value,'表达清晰，建议继续补充需求确认。');
  await act(async()=>h.button('确认并保存评价').click());assert.equal(writes,2);assert.equal(document.querySelector('[role="dialog"]'),null);assert.match(document.body.textContent,/评价已保存，但任务摘要刷新失败/);assert.equal(document.activeElement,document.querySelector('section'));
  h.button('重试同步任务摘要').focus();await act(async()=>h.button('重试同步任务摘要').click());assert.equal(syncs,2);assert.equal(writes,2);assert.equal(h.button('重试同步任务摘要'),undefined);assert.match(document.body.textContent,/暂无待评记录/);assert.equal(document.activeElement,document.querySelector('section'));
 }finally{await h.close();}
});
