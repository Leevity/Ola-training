import { useEffect, useState } from 'react';
import { Building2, GraduationCap, Loader2, LogIn, RefreshCw } from 'lucide-react';
import * as api from './api';
import type { Identity, Snapshot } from './api';
export function SessionGate({children}:{children:(snapshot:Snapshot,user:Identity,refresh:()=>Promise<void>,signOut:()=>Promise<void>)=>React.ReactNode}){
 const [session,setSession]=useState<{snapshot:Snapshot;user:Identity}|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('');
 const refresh=async()=>{setLoading(true);setError('');try{const user=await api.me();const snapshot=await api.bootstrap();setSession({user,snapshot});}catch(e){setSession(null);if(!(e instanceof api.ApiError&&e.status===401))setError(e instanceof Error?e.message:'服务连接失败');}finally{setLoading(false);}};
 useEffect(()=>{void refresh();const expire=()=>{setSession(null);setLoading(false);};window.addEventListener('ola:session-expired',expire);return()=>window.removeEventListener('ola:session-expired',expire);},[]);
 if(loading)return <div className="session-loading"><Loader2 size={28} className="spin"/><strong>正在连接管理服务</strong><p>加载账号与企业工作空间</p></div>;
 if(session)return children(session.snapshot,session.user,refresh,async()=>{await api.logout();setSession(null);});
 return <LoginForm error={error} onRetry={refresh} onLogin={async(email,password)=>{await api.login(email,password);await refresh();}}/>;
}
function LoginForm({error:externalError,onLogin,onRetry}:{error:string;onLogin:(email:string,password:string)=>Promise<void>;onRetry:()=>Promise<void>}){
 const[email,setEmail]=useState('admin@ola.local');const[password,setPassword]=useState('');const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 return <div className="login-page"><div className="login-brand"><span><img src="/assets/ola-app-icon.png" alt="" /></span><strong>ola<span>-training</span></strong></div><div className="login-panel"><div className="login-kicker"><Building2 size={17}/>企业培训管理平台</div><h1>登录管理工作台</h1><p>使用企业账号，管理课程、任务与组织成员。</p><form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await onLogin(email,password);}catch(e){setError(e instanceof Error?e.message:'登录失败');}finally{setBusy(false);}}}><label className="field"><span>账号邮箱</span><input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label className="field"><span>登录密码</span><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required maxLength={128}/></label>{(error||externalError)&&<div role="alert" className="error-message">{error||externalError}</div>}<button type="submit" className="button primary full-width" disabled={busy}>{busy?<Loader2 className="spin" size={17}/>:<LogIn size={17}/>}登录工作台</button></form><button className="text-button" onClick={()=>void onRetry()}><RefreshCw size={14}/>重新连接服务</button>{import.meta.env.DEV&&<div className="login-dev-note">首次本机启动账号保存在 backend/data/bootstrap-credentials.txt；密码不存入浏览器。</div>}</div><footer>ola-training · 统一身份与企业工作空间</footer></div>;
}
