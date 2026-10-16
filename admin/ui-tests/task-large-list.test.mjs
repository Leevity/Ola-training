import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
const {JSDOM}=createRequire(new URL('../../packages/classroom-ui/package.json',import.meta.url))('jsdom');
test('125成员/课程：跨页保留，筛选全选跨页且不改其他部门，过滤停用及跨企业数据',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.HTMLElement=dom.window.HTMLElement;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {createRoot}=await import('react-dom/client');const {TaskEditor}=await import('../src/editors.tsx');const root=createRoot(document.getElementById('root'));
 const members=Array.from({length:125},(_,i)=>({id:'m'+i,tenantId:'demo',name:'成员'+i,employeeNo:'DEMO-'+i,department:i<65?'服务部':'培训部',active:true}));
 const courses=Array.from({length:125},(_,i)=>({id:'c'+i,tenantId:'demo',title:'课程'+i,category:'服务',kind:'learn',version:2,status:'published'}));
 const task={id:'new',tenantId:'demo',title:'虚构大列表',start:'2026-10-16',due:'2026-10-30',description:'',status:'draft',courseIds:[],memberIds:[]};let saved;
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
 const click=async text=>act(async()=>button(text).click());
 const check=async index=>act(async()=>document.querySelectorAll('input[type="checkbox"]')[index].click());
 const change=async (element,value)=>act(async()=>{Object.getOwnPropertyDescriptor(element.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new dom.window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));});
 try{
 await act(async()=>root.render(React.createElement(TaskEditor,{task,db:{courses:[...courses,{...courses[0],id:'other-course',tenantId:'other'}],members:[...members,{...members[0],id:'disabled',active:false},{...members[0],id:'other',tenantId:'other'}]},onSave:async value=>{saved=structuredClone(value);return false;},onClose(){}})));
 await click('2编排课程');assert.equal(document.querySelectorAll('input[type="checkbox"]').length,10);
 await check(0);await click('下一页');await check(0);await click('上一页');assert.equal(document.querySelector('input[type="checkbox"]').checked,true);
 await click('3分配成员');assert.equal(document.querySelectorAll('input[type="checkbox"]').length,11);
 await check(1);await click('下一页');await check(1);
 await change(document.querySelector('[aria-label="按部门筛选接收成员"]'),'培训部');assert.match(document.querySelector('nav').textContent,/第 1 \/ 6 页/);
 await check(0);await click('保存草稿');assert.equal(saved.memberIds.length,62);assert.deepEqual(saved.courseIds,['c0','c10']);
 assert.ok(!saved.memberIds.includes('other'));assert.ok(!saved.memberIds.includes('disabled'));
 await check(0);await click('保存草稿');assert.deepEqual(saved.memberIds,['m0','m10']);
 await change(document.querySelector('[aria-label="按部门筛选接收成员"]'),'全部部门');
 for(let i=0;i<12;i++)await click('下一页');assert.equal(document.querySelectorAll('input[type="checkbox"]').length,6);assert.equal(button('下一页').disabled,true);
 await change(document.querySelector('[aria-label="搜索成员"]'),'无匹配成员');assert.match(document.body.textContent,/没有匹配的成员/);assert.equal(document.querySelector('nav'),null);
 await change(document.querySelector('[aria-label="搜索成员"]'),'');assert.match(document.querySelector('nav').textContent,/第 1 \/ 13 页/);assert.equal(document.querySelectorAll('input[type="checkbox"]')[1].checked,true);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
