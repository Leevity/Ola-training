import { randomId } from '../../shared/random-id.ts';
import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import type { Course, Knowledge } from './domain';
import { Field } from './ui';
import * as api from './api';

const stateLabels:Record<string,string>={queued_outline:'等待生成大纲',running_outline:'正在生成大纲',awaiting_outline:'待审阅大纲',queued_scenes:'等待生成场景',running_scenes:'正在生成场景',ready:'待应用课程草稿',paused:'已暂停',cancelled:'已取消',applied:'已应用草稿'};
export function LocalAuthoringPanel({courses,knowledge,onDataChange,onBusyChange,onDirtyChange}:{courses:Course[];knowledge:Knowledge[];onDataChange:()=>Promise<void>;onBusyChange:(busy:boolean)=>void;onDirtyChange:(dirty:boolean)=>void}){
 const [courseId,setCourseId]=useState(courses.find(c=>c.status==='draft'&&c.kind==='learn')?.id||'');
 const [requirement,setRequirement]=useState('');const [knowledgeIds,setKnowledgeIds]=useState<string[]>([]);
 const [jobs,setJobs]=useState<any[]>([]);const [job,setJob]=useState<any>(null);const [outlines,setOutlines]=useState<any[]>([]);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 const [configured,setConfigured]=useState<boolean|null>(null);const key=useRef(randomId());
 const working=useRef(false);const requestSequence=useRef(0);const selected=useRef<string|null>(null);const active=useRef(true);const dirty=useRef(false);const outlineRevision=useRef(0);
 const load=async()=>{const sequence=++requestSequence.current;const result=await api.localAuthoringJobs();if(!active.current||sequence!==requestSequence.current)return;setJobs(result.items);const selectedId=selected.current;if(selectedId){const detail=await api.localAuthoringJob(selectedId);if(active.current&&sequence===requestSequence.current&&selected.current===selectedId){setJob(detail);if(!dirty.current){setOutlines(detail.outline);outlineRevision.current=detail.revision;}}}};
 useEffect(()=>{active.current=true;void Promise.all([load(),api.localAuthoringStatus().then(s=>{if(active.current)setConfigured(s.configured);})]).catch(e=>{if(active.current)setError(e.message);});const timer=setInterval(()=>{if(!working.current)void load().catch(()=>{});},3000);return()=>{active.current=false;requestSequence.current++;clearInterval(timer);};},[]);
 useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false);},[busy,onBusyChange]);
 useEffect(()=>{onDirtyChange(dirty.current);});
 useEffect(()=>{const before=(event:BeforeUnloadEvent)=>{if(dirty.current){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',before);return()=>{window.removeEventListener('beforeunload',before);onDirtyChange(false);};},[onDirtyChange]);
 const work=async(action:()=>Promise<void>)=>{if(working.current)return;working.current=true;requestSequence.current++;setBusy(true);setError('');setMessage('');try{await action();}catch(e){setError((e as Error).message);}finally{working.current=false;setBusy(false);}};
 const show=async(id:string)=>{if(dirty.current&&!window.confirm('大纲有未保存的修改。放弃修改并加载任务？'))return;const sequence=++requestSequence.current;const detail=await api.localAuthoringJob(id);if(!active.current||sequence!==requestSequence.current)return;selected.current=id;dirty.current=false;setJob(detail);setOutlines(detail.outline);outlineRevision.current=detail.revision;};
 const command=async(action:'confirm'|'retry'|'cancel'|'apply')=>work(async()=>{
  if(dirty.current&&action==='cancel'&&!window.confirm('大纲有未保存的修改。放弃修改并取消任务？'))return;requestSequence.current++;const course=courses.find(c=>c.id===job.courseId);const next=await api.localAuthoringCommand(job.id,job.revision,action,action==='apply'?course?.updatedAt:undefined);setJob(next);dirty.current=false;setOutlines(next.outline);await onDataChange();await load();setMessage(action==='apply'?'课堂已应用到课程草稿。请继续编辑并预览，确认后发布。':'操作已保存。');
 });
 return <section aria-label="本地 AI 制课" className="authoring-panel">
  <h3 className="subheading">资料制课</h3>
  <p className="muted">选择资料生成大纲，确认后生成课堂。结果先保存为课程草稿，由你审核发布。</p>
  {error&&<div role="alert" className="error-message">{error}</div>}{message&&<p role="status" className="notice">{message}</p>}
  {configured===false&&<p className="notice">请先在上方保存模型服务配置，再刷新制课状态。</p>}
  <form onSubmit={e=>{e.preventDefault();void work(async()=>{const created=await api.startLocalAuthoring({courseId,requirement,knowledgeIds},key.current);key.current=randomId();await show(created.id);await onDataChange();await load();setMessage('制课任务已提交。可以关闭窗口，稍后回来查看进度。');});}}>
   <fieldset disabled={busy} style={{border:0,margin:0,padding:0}}>
    <Field label="目标学习课程草稿"><select required value={courseId} onChange={e=>{setCourseId(e.target.value);key.current=randomId();}}><option value="">请选择学习课程草稿</option>{courses.filter(c=>c.status==='draft'&&c.kind==='learn').map(c=><option value={c.id} key={c.id}>{c.title}</option>)}</select></Field>
    <div className="field"><span>制课资料（最多20份，总正文不超过10万字符）</span>
     {knowledge.filter(k=>k.status!=='archived').length?knowledge.filter(k=>k.status!=='archived').map(k=><div className="ordered-row" key={k.id}>
      <label className="authoring-material" style={{display:'flex',gap:10,alignItems:'center',flex:1,minWidth:0}}><input type="checkbox" disabled={k.status!=='ready'} checked={knowledgeIds.includes(k.id)} onChange={e=>{setKnowledgeIds(ids=>e.target.checked?[...ids,k.id]:ids.filter(id=>id!==k.id));key.current=randomId();}}/><span>{k.name}<small className="muted" style={{display:'block'}}>{k.parseError|| (k.status==='ready'?'已提取正文':k.parsing?'正在解析':'待解析')}{k.pageCount?` · ${k.pageCount} 页`:''}</small></span></label>
      {k.status!=='ready'&&<button className="button" type="button" disabled={k.parsing} onClick={()=>void work(async()=>{try{await api.parseMaterial(k.id);}finally{await onDataChange();}setMessage('资料已解析，可以加入制课。');})}>解析正文</button>}
     </div>):<p className="notice">暂无资料。可以先上传知识文件，也可以仅根据制课要求生成。</p>}
    </div>
    <Field label="制课要求"><textarea required rows={3} maxLength={10000} placeholder="描述受众、主题、学习目标和课时安排" value={requirement} onChange={e=>{setRequirement(e.target.value);key.current=randomId();}}/></Field>
    <button className="button primary" type="submit" disabled={!courseId||configured===false||knowledgeIds.length>20}><Sparkles size={16}/>生成大纲</button>
    <button className="button" type="button" style={{marginLeft:10}} onClick={()=>void work(async()=>{setConfigured((await api.localAuthoringStatus()).configured);await load();})}><RefreshCw size={16}/>刷新状态</button>
   </fieldset>
  </form>
  <h3 className="subheading">制课任务</h3>
  {!jobs.length?<p className="muted info-line">尚无本地制课任务。</p>:jobs.map(item=><div className="ordered-row" key={item.id}><div style={{flex:1,minWidth:0}}><strong>{courses.find(c=>c.id===item.courseId)?.title||item.courseId}</strong><p className="muted">{stateLabels[item.state]||item.state}{item.totalScenes?` · ${item.completedScenes}/${item.totalScenes} 个场景`:''}</p></div><button className="button" disabled={busy} onClick={()=>void work(()=>show(item.id))}>查看</button></div>)}
  {job&&<section className="notice" aria-label="制课任务详情"><h3>{stateLabels[job.state]||job.state} · {job.courseTitle||'课堂'}</h3><p className="muted">模型：{job.model} · 已保存 {job.completedScenes}/{job.totalScenes} 个场景</p>{job.error&&<p role="alert" className="error-message">{job.error}</p>}
   {job.state==='awaiting_outline'&&<>
    <p>编辑每个场景的标题、说明和知识点；保存后再确认生成。{dirty.current&&<strong role="status"> 当前大纲有未保存修改。</strong>}</p>
    <fieldset disabled={busy} style={{border:0,padding:0}}>{outlines.map((outline,index)=><div className="authoring-outline" key={outline.id}><strong>场景 {index+1} · {({slide:'课件',quiz:'测验',interactive:'互动',pbl:'项目训练'} as Record<string,string>)[outline.type]}</strong>
     <Field label={`场景 ${index+1} 标题`}><input maxLength={160} value={outline.title} onChange={e=>{dirty.current=true;setOutlines(items=>items.map((v,i)=>i===index?{...v,title:e.target.value}:v));}}/></Field>
     <Field label={`场景 ${index+1} 说明`}><textarea rows={2} maxLength={10000} value={outline.description} onChange={e=>{dirty.current=true;setOutlines(items=>items.map((v,i)=>i===index?{...v,description:e.target.value}:v));}}/></Field>
     <Field label={`场景 ${index+1} 知识点（每行一个）`}><textarea rows={2} value={outline.keyPoints.join('\n')} onChange={e=>{dirty.current=true;setOutlines(items=>items.map((v,i)=>i===index?{...v,keyPoints:e.target.value.split('\n')}:v));}}/></Field>
    </div>)}</fieldset>
    <div className="title-actions"><button className="button" disabled={busy} onClick={()=>void work(async()=>{requestSequence.current++;const next=await api.saveLocalOutline(job.id,outlineRevision.current,outlines);dirty.current=false;outlineRevision.current=next.revision;setJob(next);setOutlines(next.outline);await onDataChange();setMessage('大纲修订已保存。');})}>保存大纲</button><button className="button primary" disabled={busy||dirty.current} onClick={()=>void command('confirm')}>确认大纲并生成课堂</button></div>
   </>}
   {job.state==='paused'&&<button className="button primary" disabled={busy} onClick={()=>void command('retry')}>保留已完成内容并重试</button>}
   {job.state==='ready'&&<><p>应用会替换目标草稿的课堂内容和课时。发布后的课程不受影响。</p><button className="button primary" disabled={busy} onClick={()=>void command('apply')}>应用到课程草稿</button></>}
   {!['ready','applied','cancelled'].includes(job.state)&&<button className="button" style={{marginLeft:10}} disabled={busy} onClick={()=>void command('cancel')}>取消任务</button>}
   {job.events?.length>0&&<details style={{marginTop:16}}><summary>任务记录</summary>{job.events.map((item:any)=><p className="muted" key={item.id}>{item.detail}</p>)}</details>}
  </section>}
 </section>;
}
