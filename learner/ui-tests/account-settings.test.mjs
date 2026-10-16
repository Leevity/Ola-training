import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
const {JSDOM}=createRequire(new URL('../../packages/classroom-ui/package.json',import.meta.url))('jsdom');
globalThis.React=React;

test('H5账号设置：刷新失败可恢复，退出取消不请求，失败保留确认且等待中不可关闭',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/#/my/settings'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let refreshes=0,logouts=0,release;const gate=new Promise(resolve=>{release=resolve;});const notices=[];
 const portal={session:{user:{name:'虚构学员',department:'验收部',tenantId:'qa'},tenants:[{id:'qa',shortName:'虚构企业'}]},refresh:async()=>{refreshes++;if(refreshes===1)throw new Error('刷新连接中断');},logout:async()=>{logouts++;if(logouts===1)throw new Error('退出连接中断');await gate;},notify:text=>notices.push(text),changeTenant:async()=>{},data:{}};
 const {Context}=await import('../../frontend/src/portal-context.ts');const {AccountPage}=await import('../../frontend/src/restored-pages.tsx');const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 const button=(text,scope=document)=>[...scope.querySelectorAll('button')].find(node=>node.textContent.trim()===text);
 const dialog=()=>document.querySelector('dialog');
 try{
  await act(async()=>root.render(React.createElement(Context.Provider,{value:portal},React.createElement(AccountPage,{go(){},back(){}}))));
  await act(async()=>{button('刷新学习数据').click();button('刷新学习数据').click();});assert.equal(refreshes,1);assert.match(document.querySelector('[role="alert"]').textContent,/刷新连接中断/);
  await act(async()=>button('刷新学习数据').click());assert.equal(refreshes,2);assert.equal(document.querySelector('[role="alert"]'),null);assert.deepEqual(notices,['学习数据已刷新']);
  await act(async()=>button('退出登录').click());assert.ok(dialog()?.open);assert.equal(logouts,0);
  await act(async()=>button('取消',dialog()).click());assert.equal(dialog(),null);assert.equal(logouts,0);
  await act(async()=>button('退出登录').click());await act(async()=>button('退出登录',dialog()).click());assert.equal(logouts,1);assert.match(dialog().querySelector('[role="alert"]').textContent,/退出连接中断/);
  await act(async()=>button('退出登录',dialog()).click());assert.equal(logouts,2);assert.equal(button('正在退出…',dialog()).disabled,true);
  await act(async()=>dialog().dispatchEvent(new dom.window.Event('cancel',{bubbles:false,cancelable:true})));assert.ok(dialog()?.open);
  await act(async()=>release());assert.equal(dialog(),null);assert.equal(logouts,2);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
