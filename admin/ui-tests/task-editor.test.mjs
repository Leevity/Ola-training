import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
const requireUI=createRequire(new URL('../../packages/classroom-ui/package.json',import.meta.url));
const {JSDOM}=requireUI('jsdom');

test('任务编排逐步校验，返回保留选择，发布前只核对且关闭可继续编辑',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/#tasks'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.HTMLElement=dom.window.HTMLElement;
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 Object.defineProperty(dom.window.HTMLElement.prototype,'offsetParent',{configurable:true,get(){return document.body;}});
 const {createRoot}=await import('react-dom/client');
 const {TaskEditor}=await import('../src/editors.tsx');
 const root=createRoot(document.getElementById('root'));
 const task={id:'draft',tenantId:'tenant',title:'',description:'',start:'2026-10-16',due:'2026-10-30',sequential:true,courseIds:[],memberIds:[],status:'draft',snapshot:[]};
 const db={courses:[{id:'c1',tenantId:'tenant',title:'虚构学习课程',category:'客户服务',kind:'learn',version:2,status:'published'}],members:[{id:'m1',tenantId:'tenant',name:'示范学员',employeeNo:'DEMO-AI-001',department:'客户服务部',active:true}]};
 let saves=0,closes=0;
 const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===text||el.getAttribute('aria-label')===text);
 const click=async text=>act(async()=>button(text).click());
 const fill=async (element,value)=>act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
 const select=async()=>act(async()=>document.querySelector('input[type="checkbox"]').click());
 try{
  await act(async()=>root.render(React.createElement(TaskEditor,{task,db,onSave:async()=>{saves++;return true;},onClose(){closes++;}})));
  await click('下一步');assert.match(document.body.textContent,/请填写任务名称/);
  await fill(document.querySelector('[aria-label="任务名称"]'),'虚构任务步骤验收');await click('下一步');
  assert.ok(document.querySelector('[aria-label="搜索课程"]'));
  await click('下一步');assert.match(document.body.textContent,/请至少选择一门课程，再分配成员/);
  await select();await click('下一步');assert.ok(document.querySelector('[aria-label="搜索成员"]'));
  await fill(document.querySelector('[aria-label="搜索成员"]'),'DEMO-AI-001');await select();
  await click('上一步');assert.equal(document.querySelector('input[type="checkbox"]').checked,true);
  await click('上一步');assert.equal(document.querySelector('[aria-label="任务名称"]').value,'虚构任务步骤验收');
  await click('下一步');await click('下一步');await click('核对并发布');
  assert.equal(saves,0);assert.match(document.body.textContent,/发布前核对/);assert.match(document.body.textContent,/虚构学习课程 · v2/);assert.match(document.body.textContent,/示范学员/);
  await click('返回修改');await click('关闭弹窗');assert.equal(closes,0);assert.match(document.body.textContent,/未保存的修改/);
  await act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  assert.doesNotMatch(document.body.textContent,/有未保存的修改/);assert.equal(closes,0);
  await click('关闭弹窗');await click('继续编辑');assert.equal(closes,0);assert.equal(saves,0);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
