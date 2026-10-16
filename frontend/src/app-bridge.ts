import { randomId } from '../../shared/random-id.ts';
export type HostRequest={version:1;requestId:string;type:'back'|'navigate'|'refresh'|'logout'|'download-result';payload?:{path?:string;ok?:boolean;message?:string}};
type AppDownload={path:string;filename:string;context:string};
type HostEvent={version:1;type:string;requestId?:string;payload?:unknown};
declare global{interface Window{OlaTrainingHost?:{postMessage:(message:string)=>void};webkit?:{messageHandlers?:{olaTraining?:{postMessage:(message:HostEvent)=>void}}};olaTrainingReceive?:(message:unknown)=>void;olaTrainingHostCapabilities?:string[];olaTrainingDownload?:(file:AppDownload)=>Promise<void>;}}
export function validHostRequest(value:unknown):value is HostRequest{
 if(!value||typeof value!=='object')return false;const request=value as HostRequest;
 return request.version===1&&typeof request.requestId==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(request.requestId)&&['back','navigate','refresh','logout','download-result'].includes(request.type)&&(request.type!=='navigate'||typeof request.payload?.path==='string'&&request.payload.path.length<=2048&&/^\/(?!\/)[a-zA-Z0-9_/?=&%.-]*$/.test(request.payload.path))&&(request.type!=='download-result'||typeof request.payload?.ok==='boolean'&&(request.payload.message===undefined||typeof request.payload.message==='string'&&request.payload.message.length<=500));
}
export function hasAppHost(){return Boolean(window.OlaTrainingHost||window.webkit?.messageHandlers?.olaTraining);}
export function requestAppDownload(file:AppDownload){if(!window.olaTrainingDownload)return Promise.reject(new Error('当前App尚未接入资料下载，请联系管理员更新App。'));return window.olaTrainingDownload(file);}
export function installAppBridge(actions:{navigate:(path:string)=>void|boolean|Promise<void|boolean>;beforeBack?:(willNavigate:boolean)=>boolean;refresh:()=>Promise<void>;logout:()=>Promise<void>}){
 const android=window.OlaTrainingHost,ios=window.webkit?.messageHandlers?.olaTraining;
 if(!android&&!ios)return()=>{};
 const downloadEnabled=Array.isArray(window.olaTrainingHostCapabilities)&&window.olaTrainingHostCapabilities.includes('download');
 const downloads=new Map<string,{resolve:()=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 let active=true;let depth=0;history.replaceState({...history.state,olaDepth:0},'');
 const send=(event:Omit<HostEvent,'version'>)=>{const message={version:1 as const,...event};try{if(android)android.postMessage(JSON.stringify(message));else ios?.postMessage(message);return true;}catch{return false;}};
 const receive=async(value:unknown)=>{
  let input=value;if(typeof value==='string'){try{input=JSON.parse(value);}catch{return;}}
  if(!validHostRequest(input))return;
  if(input.type==='download-result'){const pending=downloads.get(input.requestId);if(!pending)return;downloads.delete(input.requestId);clearTimeout(pending.timer);if(input.payload!.ok)pending.resolve();else pending.reject(new Error(input.payload!.message||'App下载未完成，请重试。'));return;}
  await Promise.resolve();
  if(!active)return;
  try{
   if(input.type==='navigate'&&await actions.navigate(input.payload!.path!)===false){send({type:'result',requestId:input.requestId,payload:{ok:false,message:'已取消离开，未保存内容仍保留'}});return;}
   if(input.type==='refresh')await actions.refresh();
   if(input.type==='logout')await actions.logout();
   if(input.type==='back'){if(typeof history.state?.olaDepth==='number')depth=history.state.olaDepth;if(actions.beforeBack?.(depth>0)===false){send({type:'result',requestId:input.requestId,payload:{ok:false,message:'已取消返回，未保存内容仍保留'}});return;}if(depth>0)history.back();else send({type:'back-at-root',requestId:input.requestId});}
   send({type:'result',requestId:input.requestId,payload:{ok:true}});
  }catch{send({type:'result',requestId:input.requestId,payload:{ok:false,message:'操作未完成，请在页面查看状态'}});}
 };
 const navigation=()=>{if(typeof history.state?.olaDepth==='number')depth=history.state.olaDepth;else{depth++;history.replaceState({...history.state,olaDepth:depth},'');}send({type:'navigation',payload:{path:location.hash.slice(1)||'/home'}});};
 const onHash=()=>queueMicrotask(()=>{if(active)navigation();});
 const rejectDownloads=(message:string)=>{for(const pending of downloads.values()){clearTimeout(pending.timer);pending.reject(new Error(message));}downloads.clear();};
 const expired=()=>{rejectDownloads('登录状态已变化，下载已取消。');send({type:'session-expired'});};
 const download=(file:AppDownload)=>new Promise<void>((resolve,reject)=>{
  if(!/^\/api\/learn\/knowledge\/[a-zA-Z0-9_-]{1,128}\/download(?:\?courseId=[a-zA-Z0-9_-]{1,128}&version=[1-9][0-9]*)?$/.test(file.path)||!file.filename||file.filename.length>200||/[\\/\x00-\x1f\x7f]/.test(file.filename)||!file.context||!/^[a-zA-Z0-9_:-]{1,400}$/.test(file.context)){reject(new Error('资料下载参数无效。'));return;}
  const requestId='download_'+randomId();const timer=setTimeout(()=>{downloads.delete(requestId);reject(new Error('App未确认下载结果，请先查看App下载记录再重试。'));},60000);downloads.set(requestId,{resolve,reject,timer});
  if(!send({type:'download',requestId,payload:file})){downloads.delete(requestId);clearTimeout(timer);reject(new Error('App下载服务不可用，请重试。'));}
 });
 if(downloadEnabled)window.olaTrainingDownload=download;
 window.olaTrainingReceive=receive;addEventListener('hashchange',onHash);addEventListener('ola:expired',expired);
 send({type:'ready',payload:{capabilities:['navigation','refresh','logout',...(downloadEnabled?['download']:[])],authentication:'httpOnlyCookie'}});navigation();
 return()=>{active=false;rejectDownloads('App页面已关闭，下载请求已取消。');if(window.olaTrainingDownload===download)delete window.olaTrainingDownload;if(window.olaTrainingReceive===receive)delete window.olaTrainingReceive;removeEventListener('hashchange',onHash);removeEventListener('ola:expired',expired);};
}
