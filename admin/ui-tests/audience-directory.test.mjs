import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
const {JSDOM}=createRequire(new URL('../../packages/classroom-ui/package.json',import.meta.url))('jsdom');
globalThis.React=React;
test('远程成员目录失败保留搜索，重试后恢复焦点并过滤匹配成员',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const originalFetch=globalThis.fetch;let reads=0;
 globalThis.fetch=async path=>{
  if(path==='/api/auth/me')return Response.json({user:{id:'qa',tenantId:'qa',memberId:'member'},csrf:'fixture-only-csrf'});
  assert.equal(path,'/api/tenants/qa/content-directory');reads++;
  return reads===1?Response.json({error:{code:'QA_UNAVAILABLE',message:'模拟目录失败'}},{status:503}):Response.json({items:[{id:'m1',name:'虚构甲',department:'验收部',active:true},{id:'m2',name:'虚构乙',department:'验收部',active:true}]});
 };
 const api=await import('../src/api.ts');await api.me();const {AudienceEditor}=await import('../src/audience-editor.tsx');const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 try{
  await act(async()=>root.render(React.createElement(AudienceEditor,{value:{mode:'members',memberIds:[],departments:[]},members:[],departments:['验收部'],onChange(){}})));assert.match(document.querySelector('[role="alert"]').textContent,/模拟目录失败/);
  const search=document.querySelector('input[type="search"]');await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(search,'虚构甲');search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
  const retry=[...document.querySelectorAll('button')].find(b=>b.textContent==='重新加载成员');retry.focus();await act(async()=>retry.click());assert.equal(reads,2);assert.equal(search.value,'虚构甲');assert.equal(document.activeElement,search);assert.equal(document.querySelector('[role="alert"]'),null);assert.equal(document.querySelectorAll('input[type="checkbox"]').length,1);
 }finally{await act(async()=>root.unmount());dom.window.close();globalThis.fetch=originalFetch;}
});
