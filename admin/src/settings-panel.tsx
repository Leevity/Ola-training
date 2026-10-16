import {useEffect,useRef,useState,type MutableRefObject} from 'react';
import {Check,Loader2,Sparkles} from 'lucide-react';
import type {Tenant} from './domain';
import {Badge,Field} from './ui';

type SettingsValue={name:string;shortName:string;description:string;departments:string};
const fromTenant=(tenant:Tenant):SettingsValue=>({name:tenant.name,shortName:tenant.shortName,description:tenant.description,departments:tenant.departments.join('\n')});

export function SettingsPanel({tenant,onSave,onIntegration,navigationGuard,navigationDirty}:{
 tenant:Tenant;onSave:(name:string,shortName:string,description:string,departments:string[])=>Promise<boolean>;onIntegration:()=>void;
 navigationGuard:MutableRefObject<()=>boolean>;navigationDirty:MutableRefObject<boolean>;
}){
 const [value,setValue]=useState(()=>fromTenant(tenant)),[saved,setSaved]=useState(()=>fromTenant(tenant));
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const working=useRef(false);const dirty=JSON.stringify(value)!==JSON.stringify(saved);
 useEffect(()=>{
  const guard=()=>{
   if(working.current){setError('正在保存企业设置，请稍候再离开。');return false;}
   return !dirty||window.confirm('企业设置有未保存的修改。放弃修改并离开？');
  };
  navigationGuard.current=guard;navigationDirty.current=dirty||busy;
  return()=>{if(navigationGuard.current===guard){navigationGuard.current=()=>true;navigationDirty.current=false;}};
 },[dirty,busy,navigationGuard,navigationDirty]);
 const change=(key:keyof SettingsValue,text:string)=>{setValue(current=>({...current,[key]:text}));setMessage('');setError('');};
 const submit=async()=>{
  if(working.current||!dirty)return;
  const departments=[...new Set(value.departments.split('\n').map(d=>d.trim()).filter(Boolean))];
  if(!value.name.trim()||!value.shortName.trim()||!departments.length){setError('企业名称、简称和至少一个部门不能为空');return;}
  const normalized={name:value.name.trim(),shortName:value.shortName.trim(),description:value.description.trim(),departments:departments.join('\n')};
  working.current=true;setBusy(true);setError('');setMessage('');
  try{
   if(await onSave(normalized.name,normalized.shortName,normalized.description,departments)){setValue(normalized);setSaved(normalized);setMessage('企业设置已保存。');}
   else setError('保存未完成，修改已保留。请根据操作提示修正后重试。');
  }catch(e){setError(e instanceof Error?e.message:'保存失败，修改已保留，请重试。');}
  finally{working.current=false;setBusy(false);}
 };
 return <div className="settings-grid"><section className="surface"><div className="section-heading"><div><h2>企业资料</h2><p>企业信息与组织部门</p></div></div>
  <form className="settings-form" onSubmit={e=>{e.preventDefault();void submit();}} aria-busy={busy}>
   <p className={`settings-save-state ${dirty?'unsaved':''}`} role="status">{busy?'正在保存，请稍候…':message|| (dirty?'有未保存的修改':'当前显示已保存的企业资料')}</p>
   <fieldset disabled={busy}>
    <Field label="企业名称 *"><input aria-label="企业名称" required maxLength={100} value={value.name} onChange={e=>change('name',e.target.value)}/></Field>
    <Field label="企业简称 *"><input aria-label="企业简称" required maxLength={30} value={value.shortName} onChange={e=>change('shortName',e.target.value)}/></Field>
    <Field label="企业简介"><textarea rows={3} maxLength={2000} value={value.description} onChange={e=>change('description',e.target.value)}/></Field>
    <Field label="组织部门 *" hint="每行一个部门；已有成员的部门需先转移成员后才能移除。"><textarea rows={5} value={value.departments} onChange={e=>change('departments',e.target.value)}/></Field>
   </fieldset>
   {error&&<div role="alert" className="error-message">{error}</div>}
   <div className="settings-form-actions"><button type="submit" className="button primary" disabled={busy||!dirty}>{busy?<Loader2 size={16} className="spin"/>:<Check size={16}/>} {busy?'正在保存…':'保存设置'}</button><button type="button" className="button" disabled={busy||!dirty} onClick={()=>{setValue(saved);setError('');setMessage('已恢复上次保存的内容。');}}>放弃修改</button></div>
  </form>
 </section><section className="surface capability-panel"><div className="section-heading"><div><h2>服务能力</h2><p>业务服务与扩展能力状态</p></div></div>
  {[['配置数据存储','业务数据库','已连接'],['文件原文存储','服务端文件存储','已连接'],['企业认证与隔离','会话身份、成员资格与服务端校验','已连接'],['学习、训练与考试','提供学习进度、作答与训练记录','接口可用'],['AI 制课与课件编辑','模型由企业配置，生成后需人工审阅','可配置']].map(([name,detail,state])=><div className="capability-row" key={name}><div><strong>{name}</strong><small>{detail}</small></div><Badge status="ready" label={state}/></div>)}
  <button className="button full-width" onClick={onIntegration}><Sparkles size={16}/>模型配置与资料制课</button>
 </section></div>;
}
