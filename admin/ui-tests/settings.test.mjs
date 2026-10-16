import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
const requireUI=createRequire(new URL('../../packages/classroom-ui/package.json',import.meta.url));
const {JSDOM}=requireUI('jsdom');

test('企业设置在StrictMode中保留未保存内容，保存失败可重试，等待期间不能重复提交或离页',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/#settings'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.HTMLElement=dom.window.HTMLElement;
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {createRoot}=await import('react-dom/client');
 const {SettingsPanel}=await import('../src/settings-panel.tsx');
 const root=createRoot(document.getElementById('root'));
 const navigationGuard={current:()=>true},navigationDirty={current:false};
 let finish,calls=0,submitted;
 const onSave=(...args)=>{calls++;submitted=args;return new Promise(resolve=>{finish=resolve;});};
 const tenant={id:'demo',name:'示范企业',shortName:'示范',description:'旧简介',departments:['服务部']};
 const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===text);
 const textarea=()=>document.querySelector('textarea');
 const fill=async text=>act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(textarea(),text);textarea().dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
 try{
  await act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(SettingsPanel,{tenant,onSave,onIntegration(){},navigationGuard,navigationDirty}))));
  assert.equal(navigationGuard.current(),true);assert.equal(button('保存设置').disabled,true);
  await fill(' 新简介 ');assert.equal(navigationDirty.current,true);
  window.confirm=()=>false;assert.equal(navigationGuard.current(),false);assert.equal(textarea().value,' 新简介 ');
  await act(async()=>button('保存设置').click());assert.equal(calls,1);assert.equal(submitted[2],'新简介');
  assert.equal(document.querySelector('fieldset').disabled,true);
  await act(async()=>assert.equal(navigationGuard.current(),false));
  await act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));assert.equal(calls,1);
  await act(async()=>finish(false));assert.equal(textarea().value,' 新简介 ');assert.match(document.body.textContent,/保存未完成/);assert.equal(navigationDirty.current,true);
  await act(async()=>button('保存设置').click());assert.equal(calls,2);
  await act(async()=>finish(true));assert.equal(textarea().value,'新简介');assert.equal(navigationDirty.current,false);assert.equal(button('保存设置').disabled,true);assert.match(document.body.textContent,/企业设置已保存/);
  await fill('放弃的修改');await act(async()=>button('放弃修改').click());assert.equal(textarea().value,'新简介');assert.equal(navigationGuard.current(),true);
 }finally{await act(async()=>root.unmount());assert.equal(navigationDirty.current,false);assert.equal(navigationGuard.current(),true);dom.window.close();}
});

test('知识范围关闭使用页内确认，继续编辑保留选择，放弃后关闭并恢复焦点',async()=>{
 const dom=new JSDOM('<button id="trigger">资料详情</button><div id="root"></div>',{url:'http://localhost/#knowledge'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.HTMLElement=dom.window.HTMLElement;
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 // JSDOM has no layout; provide visible geometry for the modal focus trap.
 dom.window.HTMLElement.prototype.getClientRects=function(){return [new dom.window.DOMRect(0,0,100,40)];};
 window.confirm=()=>assert.fail('知识范围不应调用阻塞式原生确认');
 const {createRoot}=await import('react-dom/client');
 const {KnowledgeDetailDialog}=await import('../src/knowledge-detail-dialog.tsx');
 const root=createRoot(document.getElementById('root'));let closed=0;
 const knowledge={id:'material',name:'示范.md',tenantId:'demo',category:'业务资料',text:'虚构资料',status:'ready',updatedAt:new Date().toISOString(),audience:{mode:'members',memberIds:[],departments:[]}};
 const member={id:'learner',name:'示范学员',department:'服务部',active:true};
 const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===text);
 function Harness(){const [open,setOpen]=React.useState(true);return open?React.createElement(KnowledgeDetailDialog,{knowledge,tenant:{id:'demo',name:'示范企业',departments:['服务部']},members:[member],onRefresh:async()=>{},onClose:()=>{closed++;setOpen(false);}}):null;}
 try{
  document.getElementById('trigger').focus();
  await act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Harness))));
  assert.equal(button('保存知识范围').disabled,true);
  await act(async()=>document.querySelector('input[type="checkbox"]').click());
  assert.equal(button('保存知识范围').disabled,false);
  await act(async()=>document.querySelector('button[aria-label="关闭弹窗"]').click());
  assert.match(document.body.textContent,/关闭后将放弃/);assert.equal(document.activeElement,button('继续编辑'));assert.equal(closed,0);
  await act(async()=>button('继续编辑').click());assert.equal(document.querySelector('input[type="checkbox"]').checked,true);assert.equal(document.activeElement?.tagName,'SELECT');
  document.getElementById('trigger').focus();await act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})));assert.equal(document.activeElement?.getAttribute('aria-label'),'关闭弹窗');
  await act(async()=>document.querySelector('input[type="checkbox"]').click());assert.equal(button('保存知识范围').disabled,true);
  await act(async()=>document.querySelector('input[type="checkbox"]').click());
  await act(async()=>button('完成').click());
  await act(async()=>button('放弃修改并关闭').click());assert.equal(closed,1);assert.equal(document.querySelector('[role="dialog"]'),null);assert.equal(document.activeElement,document.getElementById('trigger'));
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
