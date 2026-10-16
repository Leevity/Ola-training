import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SlideCanvas } from '@openmaic/renderer';
import {MediaFeedback,renderClassroomImage,renderClassroomAudio,renderClassroomVideo} from './media';
import type { QuizQuestion } from '@openmaic/dsl';
import { cleanScene, sandboxHtml, type ClassroomScene } from './safety';
import type { SceneState } from '../../../shared/classroom.ts';
export type { SceneState } from '../../../shared/classroom.ts';
export const emptySceneState=():SceneState=>({actionIndex:0,answers:{},submitted:false,notes:{}});

class CanvasBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div role="alert" className="maic-error">课件暂时无法显示，请联系管理员检查内容。</div>:this.props.children;}
}
function Quiz({questions,state,onChange,disabled}:{questions:QuizQuestion[];state:SceneState;onChange:(state:SceneState)=>void;disabled?:boolean;assetClient?:'admin'|'learner'}){
 return <div>{questions.map((q,index)=>{
  const answers=state.answers[q.id]||[];const expected=q.answer||[];
  const correct=expected.length>0&&answers.length===expected.length&&answers.every(v=>expected.includes(v));
  return <section className="maic-question" key={q.id}><h3>{index+1}. {q.question}</h3>
   {q.type==='short_answer'?<textarea rows={3} aria-label={`题目${index+1}回答`} disabled={disabled||state.submitted} value={answers[0]||''} onChange={e=>onChange({...state,answers:{...state.answers,[q.id]:[e.target.value]}})}/>:q.options?.map(option=><label key={option.value}><input type={q.type==='multiple'?'checkbox':'radio'} name={`quiz-${q.id}`} disabled={disabled||state.submitted} checked={answers.includes(option.value)} onChange={e=>onChange({...state,answers:{...state.answers,[q.id]:q.type==='multiple'?(e.target.checked?[...answers,option.value]:answers.filter(v=>v!==option.value)):[option.value]}})}/><span>{option.value} · {option.label}</span></label>)}
   {state.submitted&&<div className="maic-feedback">{q.type==='short_answer'?'回答已记录，可结合解析复习。':expected.length?correct?'回答正确':'请结合参考答案复习。':'回答已记录。'}{expected.length>0&&<p>参考答案：{expected.join('、')}</p>}{q.analysis&&<p>{q.analysis}</p>}</div>}
  </section>;
 })}<div className="maic-toolbar"><button className="maic-primary" disabled={disabled||state.submitted} onClick={()=>onChange({...state,submitted:true})}>提交课内练习</button>{state.submitted&&<button disabled={disabled} onClick={()=>onChange({...state,submitted:false})}>重新练习</button>}<small>课内练习用于复习，不计入正式考试成绩。</small></div></div>;
}
export function ScenePlayer({scene:source,state,onStateChange,disabled=false,assetClient='learner'}:{scene:unknown;state?:SceneState;onStateChange?:(state:SceneState)=>void;disabled?:boolean;assetClient?:'admin'|'learner'}){
 const scene=useMemo(()=>cleanScene(source,assetClient),[source,assetClient]);const [local,setLocal]=useState<SceneState>(state||emptySceneState());const [reading,setReading]=useState(false);
 useEffect(()=>{if(state)setLocal(state);},[state]);
 useEffect(()=>()=>{if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();},[]);
 const change=(next:SceneState)=>{setLocal(next);onStateChange?.(next);};
 if(!scene)return <div role="alert" className="maic-error">课堂内容不完整，请联系管理员。</div>;
 const actions=scene.actions||[],action=actions[Math.min(local.actionIndex,Math.max(0,actions.length-1))];
 const effects=action?.type==='spotlight'?{spotlight:{elementId:action.elementId}}:action?.type==='laser'?{laser:{elementId:action.elementId}}:{};
 const speeches=actions.filter(a=>a.type==='speech');
 return <div className="maic-player">
  <CanvasBoundary key={scene.id}>{scene.type==='slide'?<MediaFeedback key={scene.id}><div className="maic-canvas"><SlideCanvas slide={scene.content.canvas} effects={effects} canvasPercentage={98} videoInteractive renderImage={renderClassroomImage} renderAudio={renderClassroomAudio} renderVideo={renderClassroomVideo}/></div></MediaFeedback>:scene.type==='quiz'?<Quiz questions={scene.content.questions} state={local} onChange={change} disabled={disabled}/>:scene.type==='interactive'?<><iframe className="maic-widget" title={scene.title} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={sandboxHtml(scene.content.html||'')}/><p className="maic-hint">互动内容在独立区域运行。若资源无法加载，请联系管理员。</p></>:<Project scene={scene} state={local} onChange={change} disabled={disabled}/>}</CanvasBoundary>
  {actions.length>0&&<div className="maic-toolbar"><button disabled={disabled||local.actionIndex===0} onClick={()=>change({...local,actionIndex:Math.max(0,local.actionIndex-1)})}>上一段讲解</button><small>讲解 {Math.min(local.actionIndex+1,actions.length)} / {actions.length}</small><button disabled={disabled||local.actionIndex>=actions.length-1} onClick={()=>change({...local,actionIndex:local.actionIndex+1})}>下一段讲解</button>
   {typeof window!=='undefined'&&'speechSynthesis'in window&&<button disabled={disabled||!speeches.length} onClick={()=>{
    if(reading){speechSynthesis.cancel();setReading(false);return;}
    const text=action?.type==='speech'?action.text:speeches.map(a=>a.text).join('\n');const utterance=new SpeechSynthesisUtterance(text);utterance.lang='zh-CN';utterance.onend=()=>setReading(false);utterance.onerror=()=>setReading(false);speechSynthesis.cancel();speechSynthesis.speak(utterance);setReading(true);
   }}>{reading?'停止朗读':'朗读讲解'}</button>}
  </div>}
  {speeches.length>0&&<section className="maic-transcript" aria-label="课堂讲解">{speeches.map(s=><p key={s.id} className={action?.id===s.id?'current':''}>{s.text}</p>)}</section>}
 </div>;
}
function Project({scene,state,onChange,disabled}:{scene:ClassroomScene;state:SceneState;onChange:(state:SceneState)=>void;disabled:boolean}){
 if(scene.type!=='pbl')return null;
 const project=scene.content.projectV2;
 if(!project)return <p className="maic-error">项目内容不完整，请联系管理员。</p>;
 return <section><h2>{project.title}</h2><p>{project.description}</p>{project.milestones.map((milestone,index)=><div className="maic-question" key={milestone.id}><h3>{index+1}. {milestone.title}</h3><p>{milestone.description}</p>{milestone.microtasks?.map(task=><p key={task.id}>• {task.title}</p>)}<label htmlFor={`project-${milestone.id}`}>学习成果与反思</label><textarea id={`project-${milestone.id}`} rows={4} disabled={disabled} value={state.notes[milestone.id]||''} onChange={e=>onChange({...state,notes:{...state.notes,[milestone.id]:e.target.value}})}/></div>)}<p className="maic-hint">成果保存在本课时学习记录中。导师对话和项目评价按课程要求安排。</p></section>;
}
