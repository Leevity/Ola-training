import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
const {JSDOM}=createRequire(new URL('../../packages/classroom-ui/package.json',import.meta.url))('jsdom');
globalThis.React=React;

for(const failure of ['switch','me','overview','lost-response'])test(`PC企业切换 ${failure}：持久恢复、不重复写入、不混用旧企业课程`,async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/#/home',pretendToBeVisual:true});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,history:dom.window.history,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window)});
 dom.window.scrollTo=()=>{};
 const originalFetch=globalThis.fetch;let tenant='a',mode=failure,switches=0,release;
 const pending=new Promise(resolve=>{release=resolve;});
 const tenants=[{id:'a',shortName:'甲企业',name:'甲企业'},{id:'b',shortName:'乙企业',name:'乙企业'}];
 globalThis.fetch=async(path,options={})=>{
  if(path==='/api/auth/me'){
   if(tenant==='b'&&mode==='me')return Response.json({error:{code:'QA_UNAVAILABLE',message:'模拟身份连接失败'}},{status:503});
   return Response.json({user:{id:'qa',tenantId:tenant,memberId:'member-'+tenant,name:'虚构学员',department:'验收部'},tenants,csrf:'fixture-only-csrf'});
  }
  if(path==='/api/auth/switch-tenant'){
   assert.equal(options.method,'POST');switches++;if(switches===1)await pending;
   if(mode==='switch')return Response.json({error:{code:'QA_UNAVAILABLE',message:'模拟切换失败'}},{status:503});
   tenant='b';if(mode==='lost-response')throw new TypeError('模拟切换响应丢失');return Response.json({ok:true});
  }
  if(path==='/api/learn/overview'){
   if(tenant==='b'&&mode==='overview')return Response.json({error:{code:'QA_UNAVAILABLE',message:'模拟资料加载失败'}},{status:503});
   return Response.json({courses:[{id:tenant+'-course',title:(tenant==='a'?'甲':'乙')+'企业专属课程',kind:'learn',version:1,lessons:[{id:'lesson'}],category:'验收',summary:'虚构内容',cover:'/assets/home-resume-hero.webp',duration:10}],tasks:[],progress:[],training:[],attempts:[],favorites:[],notifications:[],completed:[]});
  }
  throw new Error('Unexpected test API '+path);
 };
 const App=(await import('../src/App.tsx')).default;const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 const choose=(select=document.querySelector('select[aria-label="切换企业"]'))=>{select.value='b';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
 const retry=()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='重新加载');
 try{
  await act(async()=>root.render(React.createElement(App)));assert.match(document.body.textContent,/甲企业专属课程/);
  const select=document.querySelector('select');await act(async()=>{choose(select);choose(select);});assert.equal(switches,1);assert.doesNotMatch(document.body.textContent,/企业专属课程/);
  await act(async()=>release());assert.equal(switches,1);assert.ok(document.querySelector('[role="alert"]'));
  assert.doesNotMatch(document.body.textContent,/甲企业专属课程|乙企业专属课程/);
  if(['switch','lost-response'].includes(failure))assert.match(document.body.textContent,/上次确认的企业为甲企业/);
  if(failure==='me')assert.match(document.body.textContent,/已切换到乙企业/);
  if(failure==='overview')assert.equal(document.querySelector('select').value,'b');
  mode='ok';await act(async()=>retry().click());assert.equal(switches,1);
  if(failure==='switch'){assert.match(document.body.textContent,/甲企业专属课程/);await act(async()=>choose());assert.equal(switches,2);}
  assert.match(document.body.textContent,/乙企业专属课程/);assert.doesNotMatch(document.body.textContent,/甲企业专属课程/);
 }finally{await act(async()=>root.unmount());dom.window.close();globalThis.fetch=originalFetch;}
});
