import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act,useState} from 'react';
const {JSDOM}=createRequire(new URL('../../packages/classroom-ui/package.json',import.meta.url))('jsdom');
test('可见范围125人：分页和搜索保留选择，范围切换清空旧选择，加载失败可重试',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.HTMLElement=dom.window.HTMLElement;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const originalFetch=globalThis.fetch;let calls=0,resolve,reject;
 globalThis.fetch=(url)=>{if(url==='/api/auth/me')return Promise.resolve(new Response(JSON.stringify({user:{id:'qa',tenantId:'qa',memberId:'qa'},csrf:'test-only'}),{status:200}));calls++;return new Promise((ok,fail)=>{resolve=ok;reject=fail;});};
 const {createRoot}=await import('react-dom/client');const {AudienceEditor}=await import('../src/audience-editor.tsx');const root=createRoot(document.getElementById('root'));let value;
 await (await import('../src/api.ts')).me();
 const members=Array.from({length:125},(_,i)=>({id:'m'+i,name:'成员'+i,department:i<65?'服务部':'培训部',active:true}));
 function Harness({members:items,mode='members'}){const [audience,setAudience]=useState({mode,memberIds:[],departments:[]});value=audience;return React.createElement(AudienceEditor,{value:audience,onChange:setAudience,members:items,departments:['服务部','培训部']});}
 const click=async text=>act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent===text).click());
 const change=async(el,v)=>act(async()=>{Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new dom.window.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});
 const check=async()=>act(async()=>document.querySelector('input[type="checkbox"]').click());
 try{
  await act(async()=>root.render(React.createElement(Harness,{members:[...members,{id:'off',name:'停用',department:'服务部',active:false}]})));
  assert.equal(calls,0);assert.equal(document.querySelectorAll('input[type="checkbox"]').length,10);
  await check();await click('下一页');await check();assert.deepEqual(value.memberIds,['m0','m10']);
  await change(document.querySelector('[type="search"]'),'培训部');assert.match(document.querySelector('nav').textContent,/第 1 \/ 6 页/);
  await check();assert.equal(value.memberIds.length,3);
  await change(document.querySelector('[type="search"]'),'无结果');assert.match(document.body.textContent,/没有匹配结果/);assert.equal(value.memberIds.length,3);
  await change(document.querySelector('[type="search"]'),'');assert.equal(document.querySelector('[type="checkbox"]').checked,true);
  await change(document.querySelector('select'),'departments');assert.deepEqual(value.memberIds,[]);await check();assert.deepEqual(value.departments,['服务部']);
  await act(async()=>root.render(React.createElement(Harness,{key:'remote',members:[],mode:'enterprise'})));assert.equal(calls,0);
  await change(document.querySelector('select'),'members');assert.equal(calls,1);assert.match(document.body.textContent,/正在加载成员名单/);assert.doesNotMatch(document.body.textContent,/暂无可选/);
  await act(async()=>reject(new Error('模拟名单断线')));assert.match(document.querySelector('[role="alert"]').textContent,/模拟名单断线/);
  await click('重新加载成员');assert.equal(calls,2);assert.equal(document.querySelector('[role="alert"]'),null);
  await act(async()=>resolve(new Response(JSON.stringify({items:members}),{status:200,headers:{'content-type':'application/json'}})));
  assert.equal(document.querySelector('[role="alert"]'),null);assert.equal(document.querySelectorAll('input[type="checkbox"]').length,10);assert.doesNotMatch(document.body.textContent,/正在加载/);
 }finally{await act(async()=>root.unmount());globalThis.fetch=originalFetch;dom.window.close();}
});
