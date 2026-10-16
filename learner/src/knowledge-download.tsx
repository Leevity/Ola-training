import {useState} from 'react';
import {FileText,Loader2} from 'lucide-react';
import * as api from './api';
export function KnowledgeDownload({id,course,label='下载引用原文件',className='text-btn'}:{id:string;course?:{courseId:string;version:number};label?:string;className?:string}){
 const[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <div className="download-resource"><button type="button" className={className} disabled={busy} onClick={async()=>{setBusy(true);setError('');try{api.triggerBrowserDownload(await api.downloadKnowledge(id,course));}catch(e){setError(e instanceof api.ApiError?e.message:'下载未完成，请检查网络后重试。');}finally{setBusy(false);}}}>{busy?<Loader2 size={16} className="spin"/>:<FileText size={16}/>} {busy?'正在准备下载…':label}</button>{error&&<p role="alert" className="download-error">{error} 可以重新点击下载。</p>}</div>;
}
