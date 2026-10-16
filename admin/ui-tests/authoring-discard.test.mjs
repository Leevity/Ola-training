import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
const {JSDOM}=createRequire(new URL('../../packages/classroom-ui/package.json',import.meta.url))('jsdom');
globalThis.React=React;
test('大纲页内确认覆盖关闭、视图、任务、新建、取消；继续保留输入，保存失败可重试且不调用原生确认',async()=>{
 const dom=new JSDOM('<button id="entry">AI入口</button><div id="root"></div>',{url:'http://localhost/'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 dom.window.confirm=()=>assert.fail('禁止原生confirm');
 const originalFetch=globalThis.fetch;let closes=0,saves=0,cancels=0,creates=0;
 const outline={id:'s',type:'slide',title:'原始标题',description:'说明',keyPoints:['确认需求'],order:1};
 const jobs=[{id:'j1',courseId:'c',state:'awaiting_outline',createdAt:'2026-10-17T00:00:00Z'},{id:'j2',courseId:'c',state:'paused',createdAt:'2026-10-16T00:00:00Z'}];
 const detail=id=>({...jobs.find(j=>j.id===id),revision:1,outline:[outline],completedScenes:0,totalScenes:1,courseTitle:'验收课程',model:'fixture-only'});
 globalThis.fetch=async(path,options)=>{
  if(path==='/api/auth/me')return Response.json({user:{id:'qa',tenantId:'qa',memberId:'m'},csrf:'fixture-only-csrf'});
  if(path.endsWith('/authoring/status'))return Response.json({configured:true});
  if(path.endsWith('/authoring/jobs')&&options.method==='POST'){creates++;return Response.json({id:'j1'});}
  if(path.endsWith('/authoring/jobs'))return Response.json({items:jobs});
  if(path.endsWith('/outline')){saves++;return saves===1?Response.json({error:{code:'QA',message:'模拟保存失败'}},{status:503}):Response.json({...detail('j1'),revision:2,outline:JSON.parse(options.body).outlines});}
  if(path.endsWith('/commands')){cancels++;return Response.json({...detail('j1'),state:'cancelled'});}
  if(path.endsWith('/authoring/jobs/j1'))return Response.json(detail('j1'));
  if(path.endsWith('/authoring/jobs/j2'))return Response.json(detail('j2'));
  if(path.endsWith('/openmaic/jobs'))return Response.json({items:[]});
  return Response.json({configured:false,connected:false,baseUrl:'',model:'',hasKey:false});
 };
 await (await import('../src/api.ts')).me();const {IntegrationDialog}=await import('../src/service-dialogs.tsx');const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 const buttons=text=>[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()===text),button=text=>buttons(text)[0];
 const edit=async(value='修改后的标题')=>act(async()=>{const input=document.querySelector('input');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
 const escape=()=>act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
 try{
  document.getElementById('entry').focus();await act(async()=>root.render(React.createElement(IntegrationDialog,{canConfigure:true,courses:[{id:'c',title:'验收课程',status:'draft',kind:'learn'}],knowledge:[],onClose:()=>closes++,onDataChange:async()=>{}})));
  await act(async()=>buttons('查看')[0].click());await edit();
  await escape();assert.ok(button('放弃修改并关闭'));assert.equal(closes,0);assert.equal(document.activeElement,button('继续编辑'));assert.equal(document.querySelector('[role="dialog"] input').matches(':disabled'),true);
  await escape();assert.equal(button('继续编辑'),undefined);assert.equal(document.querySelector('input').value,'修改后的标题');
  await act(async()=>document.querySelector('[role="tab"]:nth-child(2)').click());assert.ok(button('放弃修改并切换'));await act(async()=>button('继续编辑').click());assert.equal(document.querySelector('input').value,'修改后的标题');
  await act(async()=>buttons('查看')[1].click());assert.ok(button('放弃修改并加载'));await escape();assert.equal(button('继续编辑'),undefined);assert.equal(button('放弃修改并关闭'),undefined);assert.equal(document.querySelector('input').value,'修改后的标题');
  await act(async()=>button('取消任务').click());assert.equal(cancels,0);await act(async()=>document.querySelector('button[aria-label="关闭弹窗"]').click());assert.equal(buttons('继续编辑').length,2);assert.equal(buttons('继续编辑')[0].matches(':disabled'),true);await escape();assert.equal(buttons('继续编辑').length,1);assert.equal(button('放弃修改并关闭'),undefined);await escape();assert.equal(button('继续编辑'),undefined);assert.equal(cancels,0);
  await act(async()=>button('新建制课任务').click());assert.equal(creates,0);assert.ok(button('放弃修改并新建'));await act(async()=>button('继续编辑').click());
  await act(async()=>button('保存大纲').click());assert.equal(saves,1);assert.match(document.querySelector('[role="alert"]').textContent,/模拟保存失败/);assert.equal(document.querySelector('input').value,'修改后的标题');
  await act(async()=>button('保存大纲').click());assert.equal(saves,2);assert.equal(button('保存大纲').disabled,true);
  await edit('准备新任务');await act(async()=>button('新建制课任务').click());await act(async()=>button('放弃修改并新建').click());await edit('新任务生成前的未保存内容');
  await act(async()=>{const area=document.querySelector('form textarea');Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(area,'虚构制课要求');area.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
  await act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));assert.equal(creates,0);assert.ok(button('放弃修改并生成新任务'));await act(async()=>button('继续编辑').click());assert.equal(creates,0);
  await edit('再次修改');await act(async()=>buttons('查看')[1].click());await act(async()=>button('放弃修改并加载').click());assert.equal(document.querySelector('input').value,'原始标题');
  await edit('取消前修改');await act(async()=>button('取消任务').click());assert.equal(cancels,0);await act(async()=>button('放弃修改并取消任务').click());assert.equal(cancels,1);
 }finally{await act(async()=>root.unmount());dom.window.close();globalThis.fetch=originalFetch;}
});
