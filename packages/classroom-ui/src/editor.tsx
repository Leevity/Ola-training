import { randomId } from '../../../shared/random-id.ts';
import {AssetPicker,type AssetServices} from './asset-picker';
import { useCallback, useRef, useState, type SyntheticEvent } from 'react';
import { DSL_VERSION, normalizeElement, type SlideContent } from '@openmaic/dsl';
import { applyEditorTransaction, createEditorHistory, redoEditorTransaction, undoEditorTransaction, type EditorTransaction } from '@openmaic/editor/core';
import { EMPTY_SELECTION, type Selection } from '@openmaic/editor/react';
import { EditableSlideCanvasWithUI } from '@openmaic/editor/ui';
import { ScenePlayer } from './player';
import { cleanScene, type ClassroomScene } from './safety';
import { replaceSpeechActions } from './teaching';

type Document={dslVersion:string;stage:{id:string;name:string;createdAt:number;updatedAt:number};scenes:unknown[]};
function newSlide(stageId:string,order:number):ClassroomScene{
 const id=randomId();return {id,stageId,type:'slide',title:'新课件',order,actions:[],content:{type:'slide',canvas:{id:randomId(),viewportSize:1000,viewportRatio:.5625,theme:{backgroundColor:'#ffffff',themeColors:['#246bfe'],fontColor:'#172238',fontName:'Microsoft YaHei',outline:{color:'#246bfe',width:1,style:'solid'},shadow:{h:0,v:0,blur:0,color:'#000000'}},background:{type:'solid',color:'#ffffff'},elements:[normalizeElement({id:randomId(),type:'text',left:80,top:80,width:840,height:100,content:'<p>输入课件内容</p>',defaultFontName:'Microsoft YaHei',defaultColor:'#172238'})]}}};
}
function SlideEditor({scene,onChange,services}:{scene:ClassroomScene;onChange:(scene:ClassroomScene)=>void;services:AssetServices}){
 const initial=(scene.content as SlideContent);const historyRef=useRef(createEditorHistory(initial));const [history,setHistory]=useState(historyRef.current);const [selection,setSelection]=useState<Selection>(EMPTY_SELECTION);const [error,setError]=useState('');
 const accept=(next:typeof history)=>{if(services.busy)return;historyRef.current=next;setHistory(next);onChange({...scene,content:next.present} as ClassroomScene);};
 const transact=(transaction:EditorTransaction)=>{if(services.busy)return;try{setError('');accept(applyEditorTransaction(historyRef.current,transaction));}catch{setError('本次编辑无法应用，请撤销后重试。');}};
 return <><div className="maic-editor-controls"><button disabled={!history.past.length} onClick={()=>accept(undoEditorTransaction(historyRef.current))}>撤销</button><button disabled={!history.future.length} onClick={()=>accept(redoEditorTransaction(historyRef.current))}>重做</button><small>双击文字编辑；拖动元素调整位置，使用工具栏插入内容。</small></div>{error&&<p className="maic-error" role="alert">{error}</p>}<div className="maic-editor-surface"><EditableSlideCanvasWithUI host={{locale:'zh-CN',shortcutsEnabled:!services.busy,onError:e=>setError(e.message),renderAssetPicker:request=><AssetPicker request={request} services={services}/>}} slide={history.present.canvas} selection={services.busy?EMPTY_SELECTION:selection} onSelectionChange={setSelection} onTransaction={transact} insertItems={['text','image','table','line','background','latex','video','audio']} snapping/></div></>;
}
export function ClassroomEditor({value,title,onChange,uploadAsset,listAssets,onBusyChange,disabled=false}:{disabled?:boolean;value?:Document;title:string;onChange:(document:Document)=>void}&AssetServices){
 const [index,setIndex]=useState(0),[preview,setPreview]=useState(false),[assetBusy,setAssetBusy]=useState(false);const assetBusyChange=useCallback((busy:boolean)=>{setAssetBusy(busy);onBusyChange?.(busy);},[onBusyChange]);
 if(!value)return <div className="maic-editor"><p>创建课堂课件，或从资料制课任务应用生成结果。</p><div className="maic-editor-controls"><button className="maic-primary" disabled={disabled} onClick={()=>{const stageId=randomId();onChange({dslVersion:DSL_VERSION,stage:{id:stageId,name:title||'课堂',createdAt:Date.now(),updatedAt:Date.now()},scenes:[newSlide(stageId,1)]});}}>新建课堂课件</button></div></div>;
 const scenes=value.scenes.map(value=>cleanScene(value,'admin')).filter((scene):scene is ClassroomScene=>Boolean(scene));const scene=scenes[Math.min(index,scenes.length-1)];
 if(scenes.length!==value.scenes.length)return <div className="maic-error" role="alert">课堂包含无法识别的场景，请检查文档版本后再编辑。</div>;
 const update=(next:ClassroomScene[])=>{if(disabled)return;onChange({...value,stage:{...value.stage,updatedAt:Date.now()},scenes:next.map((s,i)=>({...s,order:i+1}))});};
 const replace=(next:ClassroomScene)=>update(scenes.map(s=>s.id===next.id?next:s));
 const move=(direction:number)=>{const next=[...scenes],target=index+direction;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];update(next);setIndex(target);};
 const blockWhileDisabled=(event:SyntheticEvent)=>{if(disabled){event.preventDefault();event.stopPropagation();}};
 return <div className="maic-editor" aria-busy={assetBusy||disabled} inert={disabled} onClickCapture={blockWhileDisabled} onPointerDownCapture={blockWhileDisabled} onMouseDownCapture={blockWhileDisabled} onKeyDownCapture={blockWhileDisabled} onInputCapture={blockWhileDisabled}><fieldset className="maic-editor-fieldset" disabled={assetBusy||disabled}><div className="maic-editor-controls"><button onClick={()=>setPreview(!preview)}>{preview?'继续编辑':'预览课堂'}</button><button onClick={()=>{update([...scenes,newSlide(value.stage.id,scenes.length+1)]);setIndex(scenes.length);}}>添加课件</button><button disabled={index===0} onClick={()=>move(-1)}>上移</button><button disabled={index>=scenes.length-1} onClick={()=>move(1)}>下移</button><button disabled={scenes.length<=1} onClick={()=>{update(scenes.filter(s=>s.id!==scene.id));setIndex(Math.max(0,index-1));}}>删除当前场景</button></div>
  <nav className="maic-scene-list" aria-label="课堂场景">{scenes.map((s,i)=><button key={s.id} className={scene?.id===s.id?'active':''} onClick={()=>setIndex(i)}>{i+1}. {s.title}</button>)}</nav>
  {!scene?<p role="alert" className="maic-error">课堂没有可编辑场景。</p>:preview?<ScenePlayer key={scene.id} scene={scene} assetClient="admin"/>:<>
   <label className="maic-field"><span>场景标题</span><input maxLength={160} value={scene.title} onChange={e=>replace({...scene,title:e.target.value})}/></label>
   {scene.type==='slide'?<SlideEditor key={scene.id} scene={scene} onChange={replace} services={{uploadAsset,listAssets,onBusyChange:assetBusyChange,busy:assetBusy||disabled}}/>:scene.type==='quiz'?<div>{scene.content.questions.map((q,i)=><div className="maic-question" key={q.id}>
    <label className="maic-field"><span>题目 {i+1}</span><textarea rows={2} value={q.question} onChange={e=>replace({...scene,content:{...scene.content,questions:scene.content.questions.map(item=>item.id===q.id?{...item,question:e.target.value}:item)}})}/></label>
    {q.options?.map(option=><label className="maic-field" key={option.value}><span>选项 {option.value}</span><input value={option.label} onChange={e=>replace({...scene,content:{...scene.content,questions:scene.content.questions.map(item=>item.id===q.id?{...item,options:item.options?.map(o=>o.value===option.value?{...o,label:e.target.value}:o)}:item)}})}/></label>)}
    <label className="maic-field"><span>参考答案（多个答案以英文逗号分隔）</span><input value={(q.answer||[]).join(',')} onChange={e=>replace({...scene,content:{...scene.content,questions:scene.content.questions.map(item=>item.id===q.id?{...item,answer:e.target.value.split(',').map(v=>v.trim()).filter(Boolean)}:item)}})}/></label>
    <label className="maic-field"><span>解析</span><textarea rows={2} value={q.analysis||''} onChange={e=>replace({...scene,content:{...scene.content,questions:scene.content.questions.map(item=>item.id===q.id?{...item,analysis:e.target.value}:item)}})}/></label>
   </div>)}</div>:scene.type==='interactive'?<><label className="maic-field"><span>互动内容 HTML</span><textarea rows={12} value={scene.content.html||''} onChange={e=>replace({...scene,content:{...scene.content,html:e.target.value}})}/></label><p className="maic-hint">预览在隔离区域运行，不允许访问账号、资料接口和外部网络。</p></>:<ProjectEditor scene={scene} onChange={replace}/>}
   <label className="maic-field"><span>讲解文字（每段空行分隔）</span><textarea rows={5} value={(scene.actions||[]).filter(a=>a.type==='speech').map(a=>a.text).join('\n\n')} onChange={e=>{
    replace({...scene,actions:replaceSpeechActions(scene.actions||[],e.target.value,randomId)});
   }}/></label>
  </>}
 </fieldset></div>;
}
function ProjectEditor({scene,onChange}:{scene:ClassroomScene;onChange:(scene:ClassroomScene)=>void}){
 if(scene.type!=='pbl'||!scene.content.projectV2)return <p className="maic-error">项目内容不完整。</p>;
 const project=scene.content.projectV2;
 const update=(next:typeof project)=>onChange({...scene,content:{...scene.content,projectV2:next}});
 return <div>
  <label className="maic-field"><span>项目名称</span><input value={project.title} onChange={e=>update({...project,title:e.target.value})}/></label>
  <label className="maic-field"><span>项目说明</span><textarea rows={3} value={project.description} onChange={e=>update({...project,description:e.target.value})}/></label>
  <label className="maic-field"><span>学习目标</span><textarea rows={3} value={project.learningObjective||''} onChange={e=>update({...project,learningObjective:e.target.value})}/></label>
  {project.milestones.map((milestone,index)=><div className="maic-question" key={milestone.id}>
   <label className="maic-field"><span>阶段 {index+1} 标题</span><input value={milestone.title} onChange={e=>update({...project,milestones:project.milestones.map(m=>m.id===milestone.id?{...m,title:e.target.value}:m)})}/></label>
   <label className="maic-field"><span>阶段说明</span><textarea rows={3} value={milestone.description||''} onChange={e=>update({...project,milestones:project.milestones.map(m=>m.id===milestone.id?{...m,description:e.target.value}:m)})}/></label>
   {milestone.microtasks.map(task=><label className="maic-field" key={task.id}><span>阶段任务</span><input value={task.title} onChange={e=>update({...project,milestones:project.milestones.map(m=>m.id===milestone.id?{...m,microtasks:m.microtasks.map(t=>t.id===task.id?{...t,title:e.target.value}:t)}:m)})}/></label>)}
  </div>)}
 </div>;
}
