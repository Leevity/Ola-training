import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
const {JSDOM}=createRequire(new URL('../../packages/classroom-ui/package.json',import.meta.url))('jsdom');

for(const kind of ['CourseEditor','TaskEditor','MemberEditor'])test(`${kind}: pending、失败和重试保留内容并阻止重复保存`,async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.HTMLElement=dom.window.HTMLElement;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {createRoot}=await import('react-dom/client');
 const Editor=(await import('../src/editors.tsx'))[kind];
 const root=createRoot(document.getElementById('root'));
 const value={id:'new',name:'虚构保存恢复',employeeNo:'QA-001',department:'示范部',role:'学员',tenantId:'demo',title:'虚构保存恢复',kind:'learn',category:'客户服务',summary:'虚构内容',duration:20,cover:'/assets/course-prompting.webp',version:1,status:'draft',lessons:[],knowledgeIds:[],courseIds:[],memberIds:[],start:'2026-10-16',due:'2026-10-30',description:'保留说明',snapshot:[]};
 let calls=0,closes=0,resolve,reject;
 const onSave=()=>{calls++;return new Promise((ok,fail)=>{resolve=ok;reject=fail;});};
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text||b.getAttribute('aria-label')===text);
 const click=async text=>act(async()=>button(text).click());
 try{
  await act(async()=>root.render(React.createElement(Editor,{[kind==='CourseEditor'?'course':kind==='MemberEditor'?'member':'task']:value,departments:['示范部'],db:{courses:[],knowledge:[],members:[],tenants:[]},onSave,onClose:()=>closes++})));
  await act(async()=>{button(kind==='MemberEditor'?'保存成员':'保存草稿').click();button(kind==='MemberEditor'?'保存成员':'保存草稿').click();});
  assert.equal(calls,1);assert.match(document.querySelector('[role="status"]').textContent,/正在保存/);
  assert.equal(document.querySelector('fieldset').disabled,true);
  await click('关闭弹窗');assert.equal(closes,0);
  await act(async()=>reject(new Error('连接中断，请重试')));
  assert.match(document.querySelector('[role="alert"]').textContent,/连接中断/);
  assert.equal(document.querySelector('fieldset').disabled,false);
  assert.equal(document.querySelector('input').value,'虚构保存恢复');
  await click(kind==='MemberEditor'?'保存成员':'保存草稿');assert.equal(calls,2);assert.equal(document.querySelector('[role="alert"]'),null);
  await act(async()=>resolve(false));
  assert.match(document.querySelector('[role="alert"]').textContent,/填写内容已保留/);assert.equal(closes,0);
  await click(kind==='MemberEditor'?'保存成员':'保存草稿');await act(async()=>resolve(true));assert.equal(calls,3);assert.equal(closes,1);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
