import {useEffect,useRef,useState} from 'react';
import {FileText,RefreshCw} from 'lucide-react';
import type {Knowledge,Member,Tenant} from './domain';
import * as api from './api';
import {Modal} from './ui';
import {KnowledgeAudiencePanel} from './knowledge-audience-panel';

export function KnowledgeDetailDialog({knowledge:k,tenant,members,onClose,onRefresh}:{knowledge:Knowledge;tenant:Tenant;members:Member[];onClose:()=>void;onRefresh:()=>Promise<void>}){
 const[parsing,setParsing]=useState(false),[savingScope,setSavingScope]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const refreshing=useRef(false),latestRefresh=useRef(onRefresh);latestRefresh.current=onRefresh;
 const busy=parsing||savingScope;
 useEffect(()=>{if(!k.parsing)return;const timer=setInterval(async()=>{if(refreshing.current)return;refreshing.current=true;try{await latestRefresh.current();}catch(e){setError((e as Error).message);}finally{refreshing.current=false;}},2500);return()=>clearInterval(timer);},[k.parsing]);
 const parse=async()=>{setParsing(true);setError('');setMessage('');try{await api.parseMaterial(k.id);setMessage('正文解析完成，已更新预览，可用于资料制课。');}catch(e){setError((e as Error).message);}finally{try{await onRefresh();}catch(e){setError(`更新文件状态失败：${(e as Error).message}`);}setParsing(false);}};
 return <Modal wide title="文件详情" description={k.name} onClose={()=>{if(!busy)onClose();}} footer={<button className="button primary" disabled={busy} onClick={onClose}>完成</button>}>
 <div className="detail-facts"><span>所属企业<strong>{tenant.name}</strong></span><span>文件分类<strong>{k.category}</strong></span><span>处理状态<strong>{k.status==='archived'?'已归档':parsing||k.parsing?'正在解析':k.parseError?'解析失败':k.status==='ready'?'正文可用':'待解析'}</strong></span><span>文本页数<strong>{k.pageCount||'尚未解析'}</strong></span></div>
 {error&&<p role="alert" className="error-message">{error}</p>}{k.parseError&&k.parseError!==error&&<p role="alert" className="error-message">{k.parseError}</p>}{message&&<p role="status" className="notice">{message}</p>}
 {k.status!=='archived'&&<div className="title-actions"><button className="button" disabled={busy||k.parsing} onClick={()=>void parse()}><FileText size={16}/>{parsing||k.parsing?'正在解析…':k.parseError?'重试解析':k.text!==undefined?'重新解析正文':'解析正文'}</button><button className="button" disabled={busy} onClick={()=>void onRefresh().catch(e=>setError(e.message))}><RefreshCw size={16}/>刷新状态</button></div>}
 <h3 className="subheading">正文预览</h3>{k.text!==undefined?<><p className="muted">{k.text.length.toLocaleString('zh-CN')} 字符 · 原文件保留，生成课程时会保存资料快照。</p><pre className="document-preview">{k.text}</pre></>:<p className="notice">尚无正文。点击解析正文后可预览并用于制课；扫描件需先进行 OCR。</p>}
 {k.status!=='archived'&&<KnowledgeAudiencePanel key={k.id} knowledge={k} departments={tenant.departments} members={members} onSaved={onRefresh} onBusyChange={setSavingScope} disabled={parsing||k.parsing}/>}
 </Modal>;
}
