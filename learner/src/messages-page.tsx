import {useEffect,useRef,useState} from 'react';
import {Bell,Check,ChevronRight} from 'lucide-react';
import * as api from './api';
import {usePortal} from './context';
import {Empty,PageTitle} from './ui';
import {dateTime} from './domain';
import {withReturnTo,routeChoice,choiceRoute} from '../../shared/learner-navigation';
import {keepListScroll} from '../../shared/learner-list-scroll';

export function Messages(){
 const {data,go,refresh,user,notify}=usePortal();
 const [tab,setTab]=useState(()=>routeChoice(location.hash,'tab',['all','unread'],'all'));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const mounted=useRef(true),pending=useRef(false),retry=useRef<{ids:string[];href?:string}>({ids:[]});
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>keepListScroll(user.tenantId+':'+user.memberId),[]);
 const read=async(ids:string[],href?:string)=>{
  if(pending.current)return;
  pending.current=true;
  const source=location.hash;
  setBusy(true);setError('');retry.current={ids:[...ids],href};
  try{
   await api.readNotices(ids);if(!mounted.current)return;
   await refresh();if(!mounted.current)return;
   if(href)go(withReturnTo(href,source));else notify('已全部标为已读');
  }catch(e){if(mounted.current)setError((e as Error).message);}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 };
 const list=data.notifications.filter(n=>tab==='all'||!n.read);
 return <>
  <PageTitle title="站内消息" description="与你相关的任务和学习结果。">
   <button className="btn" disabled={busy||!data.notifications.some(n=>!n.read)} onClick={()=>void read(data.notifications.filter(n=>!n.read).map(n=>n.id))}><Check size={16}/>全部已读</button>
  </PageTitle>
  <div className="plain-tabs message-tabs">
   <button disabled={busy} className={tab==='all'?'selected':''} onClick={()=>{setTab('all');go(choiceRoute(location.hash,{tab:'all'}));}}>全部消息</button>
   <button disabled={busy} className={tab==='unread'?'selected':''} onClick={()=>{setTab('unread');go(choiceRoute(location.hash,{tab:'unread'}));}}>未读 {data.notifications.filter(n=>!n.read).length}</button>
  </div>
  {error&&<div className="error-note" role="alert">{error}<button className="text-btn" disabled={busy} onClick={()=>void read(retry.current.ids,retry.current.href)}>重试</button></div>}
  <section className="messages-list">{list.length?list.map(n=><button key={n.id} disabled={busy} className={n.read?'':'unread'} onClick={()=>void read([n.id],n.href)}>
   <span className="soft-icon"><Bell size={19}/></span>
   <div><strong>{n.title}{!n.read&&<i className="unread-dot"/>}</strong><p>{n.text}</p></div>
   <time>{dateTime(n.at)}</time><ChevronRight size={17}/>
  </button>):<Empty title="暂无消息" hint={tab==='unread'?'所有消息都已读完':'新的任务与学习结果将在这里通知你'}/>}</section>
 </>;
}
