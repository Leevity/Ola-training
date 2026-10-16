import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
const requireUI=createRequire(new URL('../../packages/classroom-ui/package.json',import.meta.url));
const {JSDOM}=requireUI('jsdom');
globalThis.React=React;
async function fixture(client,{fail=false,deferred=false}={}){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/#/messages?tab=unread',pretendToBeVisual:true});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window)});
 dom.window.scrollTo=()=>{};
 const originalFetch=globalThis.fetch;let calls=0,refreshes=0,release;
 const gate=new Promise(resolve=>{release=resolve;});const paths=[];
 const data={notifications:[{id:'n',title:'示范任务通知',text:'仅用于隔离组件测试',at:new Date().toISOString(),href:'/task/t',read:false}],courses:[],tasks:[],progress:[],training:[],attempts:[],completed:[],favorites:[]};
 globalThis.fetch=async(path,init)=>{
  assert.equal(path,'/api/learn/notifications/read');assert.equal(init.method,'POST');calls++;
  if(deferred)await gate;
  if(fail&&calls===1)throw new TypeError('Failed to fetch');
  return Response.json({ok:true});
 };
 const portal={data,user:{id:'demo',tenantId:'tenant',memberId:'member'},session:{user:{id:'demo',tenantId:'tenant',memberId:'member'}},go:path=>paths.push(path),refresh:async()=>{refreshes++;data.notifications[0].read=true;return data;},notify(){}};
 let Component,Context;
 if(client==='pc'){Component=(await import('../src/messages-page.tsx')).Messages;Context=(await import('../src/context.tsx')).PortalContext;}
 else{Component=(await import('../../frontend/src/record-pages.tsx')).Messages;Context=(await import('../../frontend/src/portal-context.ts')).Context;}
 const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 await act(async()=>root.render(React.createElement(Context.Provider,{value:portal},React.createElement(Component,{go:portal.go,back(){}}))));
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim().includes(text));
 let unmounted=false;
 return {button,paths,get calls(){return calls;},get refreshes(){return refreshes;},release,unmount:async()=>{await act(async()=>root.unmount());unmounted=true;},close:async()=>{if(!unmounted)await act(async()=>root.unmount());dom.window.close();globalThis.fetch=originalFetch;}};
}
for(const client of ['pc','h5']){
 test(`${client} 消息标记失败保留列表和重试，成功后再进入详情`,async()=>{
  const f=await fixture(client,{fail:true});try{
   await act(async()=>f.button('示范任务通知').click());assert.equal(f.calls,1);assert.equal(f.paths.length,0);assert.match(document.body.textContent,/连接中断/);
   await act(async()=>f.button('重试').click());assert.equal(f.calls,2);assert.equal(f.refreshes,1);assert.equal(f.paths.length,1);
   assert.equal(f.paths[0],client==='pc'?'/task/t?returnTo=%2Fmessages%3Ftab%3Dunread':'/task/t');
  }finally{await f.close();}
 });
 test(`${client} 消息连续点击只发一次请求，离页后完成不把用户拉回详情`,async()=>{
  const f=await fixture(client,{deferred:true});try{
   await act(async()=>{f.button('示范任务通知').click();f.button('示范任务通知').click();});assert.equal(f.calls,1);
   await f.unmount();await act(async()=>{f.release();await new Promise(setImmediate);});assert.equal(f.refreshes,0);assert.equal(f.paths.length,0);
  }finally{await f.close();}
 });
}
