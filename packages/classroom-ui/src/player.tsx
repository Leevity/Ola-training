import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SlideCanvas } from '@openmaic/renderer';
import {MediaFeedback,renderClassroomImage,renderClassroomAudio,renderClassroomVideo} from './media';
import type { QuizQuestion } from '@openmaic/dsl';
import { cleanScene, type ClassroomScene } from './safety';
import {Widget} from './widget';
import { teachingStep } from './teaching';
import { slideReadingText } from './slide-reading';
import type { SceneState } from '../../../shared/classroom.ts';
export type { SceneState } from '../../../shared/classroom.ts';
export const emptySceneState=():SceneState=>({actionIndex:0,answers:{},submitted:false,notes:{}});

class CanvasBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div role="alert" className="maic-error">课件暂时无法显示，请联系管理员检查内容。</div>:this.props.children;}
}
function Quiz({questions,state,onChange,disabled}:{questions:QuizQuestion[];state:SceneState;onChange:(state:SceneState)=>void;disabled?:boolean;assetClient?:'admin'|'learner'}){
 const ready=questions.length>0&&questions.every(q=>state.answers[q.id]?.some(value=>value.trim()));
 return <div>{questions.map((q,index)=>{
  const answers=state.answers[q.id]||[];const expected=q.answer||[];
  const correct=expected.length>0&&answers.length===expected.length&&answers.every(v=>expected.includes(v));
  return <section className="maic-question" key={q.id}><h3>{index+1}. {q.question}</h3>
   {q.type==='short_answer'?<textarea rows={3} aria-label={`题目${index+1}回答`} disabled={disabled||state.submitted} value={answers[0]||''} onChange={e=>onChange({...state,answers:{...state.answers,[q.id]:[e.target.value]}})}/>:q.options?.map(option=><label key={option.value}><input type={q.type==='multiple'?'checkbox':'radio'} name={`quiz-${q.id}`} disabled={disabled||state.submitted} checked={answers.includes(option.value)} onChange={e=>onChange({...state,answers:{...state.answers,[q.id]:q.type==='multiple'?(e.target.checked?[...answers,option.value]:answers.filter(v=>v!==option.value)):[option.value]}})}/><span>{option.value} · {option.label}</span></label>)}
   {state.submitted&&<div className="maic-feedback">{q.type==='short_answer'?'回答已记录，可结合解析复习。':expected.length?correct?'回答正确':'请结合参考答案复习。':'回答已记录。'}{expected.length>0&&<p>参考答案：{expected.join('、')}</p>}{q.analysis&&<p>{q.analysis}</p>}</div>}
  </section>;
 })}<div className="maic-toolbar"><button className="maic-primary" disabled={disabled||state.submitted||!ready} onClick={()=>onChange({...state,submitted:true})}>提交课内练习</button>{state.submitted&&<button disabled={disabled} onClick={()=>onChange({...state,submitted:false})}>重新练习</button>}<small>{ready?'课内练习用于复习，不计入正式考试成绩。':'请先完成所有题目再提交。'}</small></div></div>;
}
export function ScenePlayer({scene:source,state,onStateChange,disabled=false,assetClient='learner'}:{scene:unknown;state?:SceneState;onStateChange?:(state:SceneState)=>void;disabled?:boolean;assetClient?:'admin'|'learner'}){
 const scene=useMemo(()=>cleanScene(source,assetClient),[source,assetClient]);const [local,setLocal]=useState<SceneState>(state||emptySceneState());const [reading,setReading]=useState(false);const [focusMode,setFocusMode]=useState(false);
 useEffect(()=>{if(state)setLocal(state);},[state]);
 useEffect(()=>()=>{if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();},[]);
 const change=(next:SceneState)=>{setLocal(next);onStateChange?.(next);};
 if(!scene)return <div role="alert" className="maic-error">课堂内容不完整，请联系管理员。</div>;
 const actions=scene.actions||[],step=teachingStep(actions,local.actionIndex),action=step?.speech,focus=step?.focus;
 const effects=focusMode&&focus?.type==='spotlight'?{spotlight:{elementId:focus.elementId}}:focusMode&&focus?.type==='laser'?{laser:{elementId:focus.elementId}}:{};
 const readingText=scene.type==='slide'?slideReadingText(scene.content.canvas.elements):[];
 const speeches=actions.filter(a=>a.type==='speech');
 return <div className="maic-player">
  <CanvasBoundary key={scene.id}>{scene.type==='slide'?<MediaFeedback key={scene.id}><div className="maic-canvas-scroll" role="region" aria-label="课件画面，可横向滚动" tabIndex={0}><div className="maic-canvas"><SlideCanvas slide={scene.content.canvas} effects={effects} canvasPercentage={98} videoInteractive renderImage={renderClassroomImage} renderAudio={renderClassroomAudio} renderVideo={renderClassroomVideo}/></div></div><p className="maic-canvas-hint">左右滑动课件，查看完整内容</p></MediaFeedback>:scene.type==='quiz'?<Quiz questions={scene.content.questions} state={local} onChange={change} disabled={disabled}/>:scene.type==='interactive'?<><Widget html={scene.content.html||''} title={scene.title}/><p className="maic-hint">互动操作仅在当前页面生效，重新打开会重置；课时完成不会按互动表现评分。若内容无法使用，请联系管理员。</p></>:<Project scene={scene} state={local} onChange={change} disabled={disabled}/>}</CanvasBoundary>
  {step&&<div className="maic-toolbar"><button disabled={disabled||step.previous===undefined} onClick={()=>{if(step.previous!==undefined)change({...local,actionIndex:step.previous});}}>上一段讲解</button><small>讲解 {step.number} / {step.total}</small><button disabled={disabled||step.next===undefined} onClick={()=>{if(step.next!==undefined)change({...local,actionIndex:step.next});}}>下一段讲解</button>
   {scene.type==='slide'&&actions.some(item=>item.type==='spotlight'||item.type==='laser')&&<button type="button" aria-pressed={focusMode} onClick={()=>setFocusMode(value=>!value)}>{focusMode?'查看完整课件':'聚焦讲解'}</button>}
   {typeof window!=='undefined'&&'speechSynthesis'in window&&<button disabled={disabled||!speeches.length} onClick={()=>{
    if(reading){speechSynthesis.cancel();setReading(false);return;}
    const text=action?.type==='speech'?action.text:speeches.map(a=>a.text).join('\n');const utterance=new SpeechSynthesisUtterance(text);utterance.lang='zh-CN';utterance.onend=()=>setReading(false);utterance.onerror=()=>setReading(false);speechSynthesis.cancel();speechSynthesis.speak(utterance);setReading(true);
   }}>{reading?'停止朗读':'朗读讲解'}</button>}
  </div>}
  {readingText.length>0&&<details className="maic-slide-reading" key={scene.id}><summary>课件文字</summary><p className="maic-hint">以下为课件文本框内容；图片、图表与空间关系请结合上方画面阅读。</p>{readingText.map((text,index)=><p key={index}>{text}</p>)}</details>}
  {speeches.length>0&&<section className="maic-transcript" aria-label="课堂讲解">{speeches.map(s=><p key={s.id} className={action?.id===s.id?'current':''}>{s.text}</p>)}</section>}
 </div>;
}
function Project({scene,state,onChange,disabled}:{scene:ClassroomScene;state:SceneState;onChange:(state:SceneState)=>void;disabled:boolean}){
 if(scene.type!=='pbl')return null;
 const project=scene.content.projectV2;
 if(!project)return <p className="maic-error">项目内容不完整，请联系管理员。</p>;
 return <section><h2>{project.title}</h2><p>{project.description}</p>{project.milestones.map((milestone,index)=><div className="maic-question" key={milestone.id}><h3>{index+1}. {milestone.title}</h3><p>{milestone.description}</p>{milestone.microtasks?.map(task=><p key={task.id}>• {task.title}</p>)}<label htmlFor={`project-${milestone.id}`}>学习成果与反思</label><textarea id={`project-${milestone.id}`} rows={4} disabled={disabled} value={state.notes[milestone.id]||''} onChange={e=>onChange({...state,notes:{...state.notes,[milestone.id]:e.target.value}})}/></div>)}<p className="maic-hint">阶段成果自动保存在本课时；全部填写后可继续学习。</p></section>;
}
