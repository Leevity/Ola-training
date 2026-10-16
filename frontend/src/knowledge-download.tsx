import {useState} from 'react';
import {FileText,Loader2} from 'lucide-react';
import * as api from '@ola/learner-client';
import {hasAppHost,requestAppDownload} from './app-bridge';
export function KnowledgeDownload({id,course,label='下载引用原文件',className='text-action'}:{id:string;course?:{courseId:string;version:number};label?:string;className?:string}){
 const[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <div className="download-resource"><button type="button" className={className} disabled={busy} onClick={async()=>{setBusy(true);setError('');try{if(hasAppHost())await requestAppDownload(await api.prepareKnowledgeDownload(id,course));else api.triggerBrowserDownload(await api.downloadKnowledge(id,course));}catch(e){setError(e instanceof Error?(e instanceof api.ApiError||hasAppHost()&&!(e instanceof TypeError)?e.message:'下载未完成，请检查网络后重试。'):'下载未完成，请重试。');}finally{setBusy(false);}}}>{busy?<Loader2 size={17}/>:<FileText size={17}/>}<span>{busy?'正在准备下载…':label}</span></button>{error&&<p role="alert" className="download-error">{error}</p>}</div>;
}
