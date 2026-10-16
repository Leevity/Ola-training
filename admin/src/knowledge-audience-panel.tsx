import {useEffect,useRef,useState} from 'react';
import type {Knowledge,Member} from './domain';
import {AudienceEditor} from './audience-editor';
import {enterpriseAudience} from '../../shared/audience.ts';
import * as api from './api';
export function KnowledgeAudiencePanel({knowledge,departments,members,onSaved,onBusyChange,disabled=false}:{knowledge:Knowledge;departments:string[];members:Member[];onSaved:()=>Promise<void>;onBusyChange?:(busy:boolean)=>void;disabled?:boolean}){
 const[value,setValue]=useState(knowledge.audience||enterpriseAudience()),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[expected,setExpected]=useState(knowledge.audience||enterpriseAudience());const dirty=useRef(false);
 useEffect(()=>{if(!dirty.current){setValue(knowledge.audience||enterpriseAudience());setExpected(knowledge.audience||enterpriseAudience());}},[JSON.stringify(knowledge.audience)]);
 useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
 return <section><h3 className="subheading">知识使用范围</h3><fieldset disabled={busy||disabled} style={{border:0,padding:0,margin:0}}><AudienceEditor value={value} onChange={next=>{dirty.current=true;setValue(next);setSaved(false);}} departments={departments} members={members} allowPrivate/></fieldset>{error&&<><p role="alert" className="error-message">{error}</p><button className="button" disabled={busy||disabled} onClick={()=>{dirty.current=false;setValue(knowledge.audience||enterpriseAudience());setExpected(knowledge.audience||enterpriseAudience());setError('');}}>放弃本地修改，加载服务端范围</button></>}{saved&&<p role="status" className="notice">知识使用范围已保存。</p>}<button className="button primary" disabled={busy||disabled} onClick={async()=>{setBusy(true);setError('');setSaved(false);try{await api.setKnowledgeAudience(knowledge.id,value,expected);dirty.current=false;setExpected(value);await onSaved();setSaved(true);}catch(e){setError((e as Error).message);if(e instanceof api.ApiError&&e.status===409)await onSaved().catch(()=>{});}finally{setBusy(false);}}}>{busy?'正在保存…':'保存知识范围'}</button></section>;
}
