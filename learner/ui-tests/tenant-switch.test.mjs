import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
const {JSDOM}=createRequire(new URL('../../packages/classroom-ui/package.json',import.meta.url))('jsdom');
globalThis.React=React;

for(const failure of ['switch','overview','lost-response'])test(`H5企业切换${{'switch':'请求失败','overview':'已提交但数据失败','lost-response':'已提交但响应丢失'}[failure]}：持久反馈、隔离旧数据且重连不重复切换`,async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/#/my/settings',pretendToBeVisual:true});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const originalAdd=globalThis.addEventListener,originalRemove=globalThis.removeEventListener;
 globalThis.addEventListener=dom.window.addEventListener.bind(dom.window);
 globalThis.removeEventListener=dom.window.removeEventListener.bind(dom.window);
 const originalFetch=globalThis.fetch;let tenant='a',mode=failure,switches=0,overviews=0,recoveryGate;
 const tenants=[{id:'a',shortName:'甲企业'},{id:'b',shortName:'乙企业'}];
 globalThis.fetch=async(path,options={})=>{
  if(path==='/api/auth/me')return Response.json({user:{id:'qa',tenantId:tenant,memberId:'member-'+tenant,name:'虚构学员',department:'验收部'},tenants,csrf:'fixture-only-csrf'});
  if(path==='/api/auth/switch-tenant'){
   assert.equal(options.method,'POST');switches++;
   if(mode==='switch')return Response.json({error:{code:'QA_UNAVAILABLE',message:'模拟切换中断'}},{status:503});
   tenant='b';if(mode==='lost-response')throw new TypeError('模拟切换响应丢失');return Response.json({ok:true});
  }
  if(path==='/api/learn/overview'){
   overviews++;if(recoveryGate)await recoveryGate;
   if(tenant==='b'&&mode==='overview')return Response.json({error:{code:'QA_UNAVAILABLE',message:'模拟资料加载中断'}},{status:503});
   return Response.json({courses:[{id:tenant+'-course',title:(tenant==='a'?'甲':'乙')+'企业专属课程'}],tasks:[],progress:[],training:[],attempts:[],favorites:[],notifications:[],completed:[]});
  }
  throw new Error('Unexpected test API '+path);
 };
 const {PortalProvider,usePortal}=await import('../../frontend/src/portal.tsx');const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 function Screen(){const {session,data,changeTenant}=usePortal();return React.createElement('section',null,React.createElement('h1',null,session.user.tenantId),React.createElement('p',null,data.courses[0].title),React.createElement('button',{onClick:()=>void changeTenant('b').catch(()=>{})},'切换到乙企业'));}
 const button=text=>[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===text);
 try{
  await act(async()=>root.render(React.createElement(PortalProvider,null,React.createElement(Screen))));
  assert.match(document.body.textContent,/甲企业专属课程/);
  await act(async()=>button('切换到乙企业').click());assert.equal(switches,1);
  assert.match(document.querySelector('[role="alert"]').textContent,failure==='overview'?/已切换到乙企业/:/上次确认的企业为甲企业/);
  assert.doesNotMatch(document.body.textContent,/甲企业专属课程|乙企业专属课程/);
  mode='ok';let release;recoveryGate=new Promise(resolve=>{release=resolve;});
  await act(async()=>button('重试').click());assert.equal(switches,1);
  const reads=overviews;assert.match(document.body.textContent,/正在加载/);assert.doesNotMatch(document.body.textContent,/企业专属课程/);
  await act(async()=>window.dispatchEvent(new dom.window.Event('focus')));assert.equal(overviews,reads,'重连期间焦点刷新不得打断身份和数据的统一加载');
  await act(async()=>{recoveryGate=null;release();});
  if(failure==='switch'){assert.match(document.body.textContent,/甲企业专属课程/);await act(async()=>button('切换到乙企业').click());assert.equal(switches,2);}
  assert.match(document.body.textContent,/乙企业专属课程/);assert.doesNotMatch(document.body.textContent,/甲企业专属课程/);
 }finally{await act(async()=>root.unmount());dom.window.close();globalThis.fetch=originalFetch;globalThis.addEventListener=originalAdd;globalThis.removeEventListener=originalRemove;}
});
