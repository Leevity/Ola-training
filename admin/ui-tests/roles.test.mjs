import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React, {act} from 'react';
const {JSDOM}=createRequire(new URL('../../packages/classroom-ui/package.json',import.meta.url))('jsdom');
globalThis.React=React;
test('角色入口、深链接和只读列表与服务端权限一致，平台标记不扩大企业角色',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/#overview'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,history:dom.window.history,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,addEventListener:dom.window.addEventListener.bind(dom.window),removeEventListener:dom.window.removeEventListener.bind(dom.window),requestAnimationFrame:fn=>setTimeout(fn,0),cancelAnimationFrame:clearTimeout});
 dom.window.scrollTo=()=>{};
 const originalFetch=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;throw new Error('角色页面不得发起受限请求');};
 const {Workspace}=await import('../src/App.tsx');const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 const course={id:'c',tenantId:'qa',title:'验收课程',summary:'测试正文',category:'验收',kind:'learn',status:'published',cover:'/cover.webp',duration:10,lessons:[{id:'l',title:'第一课',format:'文本',content:'验收正文'}],knowledgeIds:[],trainingMode:'人机训练',role:'',objective:'',rubric:'',examPass:80,examMinutes:30,examAttempts:3,version:1,updatedAt:'2026-10-17T00:00:00Z'};
 const task={id:'t',tenantId:'qa',title:'验收任务',description:'部门任务',start:'2026-10-17',due:'2026-10-31',status:'draft',sequential:true,courseIds:['c'],memberIds:['m'],snapshot:[],completedMemberIds:[]};
 const member={id:'m',tenantId:'qa',name:'虚构成员',employeeNo:'QA-1',department:'验收部',role:'学员',active:true};
 const initial={revision:1,db:{schemaVersion:1,tenants:[{id:'qa',name:'验收企业',shortName:'验收',departments:['验收部'],description:''}],courses:[course],tasks:[task],members:[member],knowledge:[],audit:[]}};
 let serial=0;
 const render=async(role,route,platformAdmin=false,db=initial.db)=>{dom.window.history.replaceState(null,'',`#${route}`);await act(async()=>root.render(React.createElement(Workspace,{key:++serial,initial:{...initial,db},identity:{id:'qa',tenantId:'qa',name:'虚构用户',role,department:'验收部',platformAdmin},refreshSession:async()=>{},signOut:async()=>{}})));};
 const buttons=()=>[...document.querySelectorAll('button')];const button=text=>buttons().find(b=>b.textContent.trim()===text);
 const nav=()=>[...document.querySelectorAll('nav[aria-label="管理端导航"] a')].map(a=>a.getAttribute('href'));
 try{
  await render('内容作者','overview',true);assert.deepEqual(nav(),['#overview','#courses','#knowledge']);assert.equal(button('新建任务'),undefined);assert.equal(button('添加组织成员'),undefined);assert.match(document.querySelector('main').textContent,/当前角色：内容作者/);
  for(const route of ['tasks','members','reports','settings']){await render('内容作者',route,true);assert.match(document.querySelector('main').textContent,/当前角色无法访问/);assert.equal(document.querySelector('main table'),null);assert.ok(button('返回工作台'));}
  await render('内容作者','courses');assert.ok(button('新建课程'));assert.ok(button('编辑'));await act(async()=>button('预览').click());assert.ok(button('编辑课程'));
  await render('部门管理员','overview');assert.deepEqual(nav(),['#overview','#courses','#tasks','#members','#reports']);assert.equal(button('AI 课堂能力模型配置与资料制课'),undefined);assert.match(document.querySelector('main').textContent,/查看验收部/);
  await render('部门管理员','courses');assert.equal(button('新建课程'),undefined);assert.equal(button('编辑'),undefined);assert.equal(button('归档'),undefined);await act(async()=>button('预览').click());assert.equal(button('编辑课程'),undefined);assert.match(document.querySelector('[role="dialog"]').textContent,/验收正文/);
  await render('部门管理员','tasks');for(const label of ['新建任务','编辑','复制','归档'])assert.equal(button(label),undefined);await act(async()=>button('详情').click());assert.match(document.querySelector('[role="dialog"]').textContent,/虚构成员/);
  await render('部门管理员','members');for(const label of ['添加成员','编辑','开通账号','停用'])assert.equal(button(label),undefined);assert.ok(button('导出成员'));assert.match(document.querySelector('main').textContent,/仅查看/);
  for(const route of ['knowledge','settings']){await render('部门管理员',route);assert.match(document.querySelector('main').textContent,/当前角色无法访问/);}
  await render('部门管理员','reports',false,{...initial.db,tasks:[]});assert.equal(button('待评记录'),undefined);assert.equal(button('管理操作记录'),undefined);assert.ok(button('任务完成明细'));
  for(const route of ['courses','tasks','members']){await render('部门管理员',route,false,{...initial.db,courses:[],tasks:[],members:[]});assert.equal(button('新建课程'),undefined);assert.equal(button('新建任务'),undefined);assert.equal(button('添加成员'),undefined);assert.match(document.querySelector('main').textContent,/当前可见范围/);}
  await render('企业管理员','overview');assert.equal(nav().length,7);assert.ok(button('新建任务'));assert.ok(button('新建课程'));
  await render('企业管理员','courses');assert.ok(button('编辑'));assert.ok(button('归档'));
  await render('企业管理员','tasks');assert.ok(button('编辑'));assert.ok(button('复制'));assert.ok(button('归档'));
  await render('企业管理员','members');assert.ok(button('添加成员'));assert.ok(button('开通账号'));assert.ok(button('停用'));
  assert.equal(requests,0);
  const aiRequests=[];globalThis.fetch=async path=>{aiRequests.push(path);return Response.json(path==='/api/auth/me'?{user:{id:'qa',tenantId:'qa',memberId:'m'},csrf:'fixture-only-csrf'}:{configured:false,connected:false,items:[],model:null});};
  await (await import('../src/api.ts')).me();
  await render('内容作者','courses');await act(async()=>button('AI 制课').click());
  assert.equal(document.querySelector('[role="tablist"]').textContent.includes('模型设置'),false);
  assert.match(document.querySelector('[role="dialog"]').textContent,/请联系企业管理员完成配置/);
  assert.equal(aiRequests.some(path=>path.endsWith('/ai/provider')),false);
  await render('企业管理员','courses');await act(async()=>button('AI 制课').click());
  assert.equal(document.querySelector('[role="tablist"]').textContent.includes('模型设置'),true);
 }finally{await act(async()=>root.unmount());dom.window.close();globalThis.fetch=originalFetch;}
});
