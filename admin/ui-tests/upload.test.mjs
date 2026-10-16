import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
const {JSDOM}=createRequire(new URL('../../packages/classroom-ui/package.json',import.meta.url))('jsdom');
globalThis.React=React;
test('知识上传已确认后列表失败：只读重试、不重复上传且锁定原文件',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const {UploadDialog}=await import('../src/upload-dialog.tsx');const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 let writes=0,reads=0,closes=0,release;const gate=new Promise(resolve=>{release=resolve;});
 const button=name=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===name);
 try{
  await act(async()=>root.render(React.createElement(UploadDialog,{tenantId:'qa',onUpload:async()=>{writes++;return {ok:true};},onRefresh:async()=>{reads++;if(reads===1)throw new Error('模拟列表不可用');await gate;},onClose:()=>closes++})));
  const input=document.querySelector('input[type="file"]');Object.defineProperty(input,'files',{value:[new dom.window.File(['# 虚构'],'刷新恢复.md')]});await act(async()=>input.dispatchEvent(new dom.window.Event('change',{bubbles:true})));
  await act(async()=>button('保存文件').click());assert.equal(writes,1);assert.equal(reads,1);assert.equal(closes,0);assert.match(document.querySelector('[role="alert"]').textContent,/文件已保存.*无需再次上传/);assert.equal(input.disabled,true);assert.equal(document.querySelector('select').disabled,true);
  const retry=button('重试刷新');await act(async()=>{retry.click();retry.click();});assert.equal(writes,1);assert.equal(reads,2);assert.equal(button('正在刷新…').disabled,true);
  await act(async()=>release());assert.equal(writes,1);assert.equal(closes,1);assert.equal(document.querySelector('[role="alert"]'),null);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
test('知识上传：等待锁定文件与分类、阻止关闭、失败保留并可重试',async()=>{
 const dom=new JSDOM('<button id="entry">上传</button><div id="root"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const {UploadDialog}=await import('../src/upload-dialog.tsx');const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 let calls=0,closes=0,reject;const gate=new Promise((_,fail)=>{reject=fail;});const file=new dom.window.File(['# 虚构验收'],'虚构上传.md',{type:'text/markdown'});
 const onUpload=async(selected,category)=>{calls++;assert.equal(selected,file);assert.equal(category,'服务规范');if(calls===1)return gate;return {ok:calls===3,error:'模拟服务不可用'};};
 const button=name=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===name||b.getAttribute('aria-label')===name);
 try{
  document.getElementById('entry').focus();await act(async()=>root.render(React.createElement(UploadDialog,{tenantId:'qa',onUpload,onClose:()=>closes++})));
  const input=document.querySelector('input[type="file"]');Object.defineProperty(input,'files',{value:[file]});await act(async()=>input.dispatchEvent(new dom.window.Event('change',{bubbles:true})));
  await act(async()=>{const select=document.querySelector('select');select.value='服务规范';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  await act(async()=>{button('保存文件').click();button('保存文件').click();});assert.equal(calls,1);
  assert.equal(input.disabled,true);assert.equal(document.querySelector('select').disabled,true);assert.equal(button('关闭弹窗').disabled,true);assert.match(document.querySelector('[role="status"]').textContent,/正在上传/);
  await act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(closes,0);
  const tab=new dom.window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});await act(async()=>document.dispatchEvent(tab));assert.equal(tab.defaultPrevented,true);assert.equal(document.activeElement,document.querySelector('[role="dialog"]'));
  await act(async()=>reject(new Error('模拟上传连接中断')));assert.match(document.querySelector('[role="alert"]').textContent,/模拟上传连接中断/);assert.equal(input.files[0],file);assert.equal(document.querySelector('select').value,'服务规范');assert.equal(input.disabled,false);
  await act(async()=>button('保存文件').click());assert.equal(calls,2);assert.equal(closes,0);assert.match(document.querySelector('[role="alert"]').textContent,/模拟服务不可用/);
  await act(async()=>button('保存文件').click());assert.equal(calls,3);assert.equal(closes,1);assert.equal(document.querySelector('[role="alert"]'),null);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
