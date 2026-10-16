import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import * as api from './api';
import { Field } from './ui';

export function AIProviderPanel({onBusyChange}:{onBusyChange?:(busy:boolean)=>void}){
 const [settings,setSettings]=useState<api.AIProviderSettings|null>(null);
 const [baseUrl,setBaseUrl]=useState('');const [model,setModel]=useState('');const [key,setKey]=useState('');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 const [forbidden,setForbidden]=useState(false);
 useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
 useEffect(()=>{let active=true;api.aiProvider().then(value=>{if(active){setSettings(value);setBaseUrl(value.baseUrl);setModel(value.model);}}).catch(e=>{if(active){setError(e.message);setForbidden(e.status===403);}});return()=>{active=false;};},[]);
 if(forbidden)return <p className="notice">模型服务由企业管理员配置。内容作者可使用配置好的制课服务。</p>;
 return <section aria-label="模型服务配置">
  <h3 className="subheading"><ShieldCheck size={18}/> 模型服务配置</h3>
  <p className="muted">使用兼容 OpenAI Chat Completions 的服务。填写 API 基础地址（通常以 /v1 结尾）；密钥加密保存，页面不会回显。</p>
  {error&&<div className="error-message" role="alert">{error}</div>}
  {message&&<p className="notice" role="status">{message}</p>}
  {!settings&&!error?<p role="status">正在读取配置…</p>:<form onSubmit={async e=>{
   e.preventDefault();setBusy(true);setError('');setMessage('');
   try{await api.saveAIProvider({baseUrl,model,...(key.trim()?{apiKey:key.trim()}:{})});setKey('');setSettings(await api.aiProvider());setMessage('配置已保存。点击验证连接会发起一次真实模型请求。');}
   catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }}>
   <fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
    <div className="form-grid">
     <Field label="API 基础地址"><input type="url" required maxLength={500} placeholder="https://api.example.com/v1" value={baseUrl} onChange={e=>{setBaseUrl(e.target.value);setMessage('');}}/></Field>
     <Field label="模型名称"><input required maxLength={200} placeholder="供应商提供的模型 ID" value={model} onChange={e=>{setModel(e.target.value);setMessage('');}}/></Field>
     <Field label={settings?.hasKey?'API 密钥（留空保留已保存密钥）':'API 密钥'} wide><input type="password" autoComplete="new-password" required={!settings?.hasKey} maxLength={4096} value={key} onChange={e=>setKey(e.target.value)}/></Field>
    </div>
    <div style={{display:'flex',gap:10,margin:'16px 0'}}>
     <button className="button primary" type="submit">保存配置</button>
     <button className="button" type="button" disabled={!settings?.configured||baseUrl!==settings.baseUrl||model!==settings.model||Boolean(key)} onClick={async()=>{
      setBusy(true);setError('');setMessage('');try{const result=await api.testAIProvider();setMessage(`连接验证成功 · ${result.model} · ${result.latencyMs} ms`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
     }}>验证已保存配置</button>
    </div>
   </fieldset>
  </form>}
  {busy&&<p role="status" className="muted"><Loader2 size={16} className="spin"/>正在处理，请稍候…</p>}
 </section>;
}
