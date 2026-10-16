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

// Keep the editor mounted while a confirmation is open; cancelling must retain draft state.
test('CourseEditor: 未保存确认锁定编辑和提交，Escape继续且保存错误获得焦点',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const {CourseEditor}=await import('../src/editors.tsx');const root=createRoot(document.getElementById('root'));
 const course={id:'new',tenantId:'demo',title:'原始标题',kind:'learn',category:'客户服务',summary:'说明',duration:20,cover:'/assets/course-prompting.webp',version:1,status:'draft',lessons:[],knowledgeIds:[]};
 let saves=0,closes=0;
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text||b.getAttribute('aria-label')===text);
 const click=text=>act(async()=>button(text).click());
 try{
  await act(async()=>root.render(React.createElement(CourseEditor,{course,db:{courses:[],knowledge:[],members:[],tenants:[]},onSave:async()=>{saves++;throw new Error('测试保存失败');},onClose:()=>closes++})));
  await act(async()=>{const input=document.querySelector('input');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,'修改后的课程');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
  await click('关闭弹窗');assert.equal(closes,0);assert.equal(document.activeElement,button('继续编辑'));assert.equal(button('保存草稿'),undefined);assert.equal(document.querySelector('input').matches(':disabled'),true);assert.ok(document.querySelector('fieldset[inert]'));
  await act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
  assert.equal(button('继续编辑'),undefined);assert.equal(document.querySelector('input').value,'修改后的课程');assert.equal(document.querySelector('input').matches(':disabled'),false);
  await click('保存草稿');assert.equal(saves,1);assert.equal(document.activeElement,document.querySelector('[role="alert"]'));assert.equal(document.querySelector('input').value,'修改后的课程');
  await click('关闭弹窗');await click('放弃修改并关闭');assert.equal(closes,1);assert.equal(saves,1);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
