import {sessionContext} from '../../shared/session-context.ts';
type Identity={id:string;tenantId:string;memberId:string};
export class ApiError extends Error {
 public status:number;public code:string;
 constructor(message:string,status:number,code:string){super(message);this.status=status;this.code=code;}
}
export class AdminTransport {
 csrf='';context='';private epoch=0;
 private fetcher:typeof fetch;private onExpired:()=>void;
 constructor(options:{fetch?:typeof fetch;onExpired:()=>void},initial?:{csrf:string;context:string}){
  this.fetcher=options.fetch||((input,init)=>fetch(input,init));this.onExpired=options.onExpired;
  if(initial){this.csrf=initial.csrf;this.context=initial.context;}
 }
 setSession(user:Identity,csrf:string){this.epoch++;this.context=sessionContext(user);this.csrf=csrf;}
 clear(){this.epoch++;this.csrf='';this.context='';}
 async request<T>(path:string,method='GET',body?:unknown,headers:Record<string,string>={},raw=false):Promise<T>{
  if(!this.context&&path!=='/auth/me'&&path!=='/auth/login')throw new ApiError('页面尚未确认登录身份，请刷新后重试',403,'SESSION_REQUIRED');
  const context=this.context,epoch=this.epoch,multipart=body instanceof FormData;
  const payload=body===undefined?undefined:multipart?body:JSON.stringify(body);
  const send=()=>this.fetcher('/api'+path,{method,credentials:'same-origin',headers:{...(!['GET','HEAD'].includes(method)?{'x-csrf-token':this.csrf}:{}),...(payload!==undefined&&!multipart?{'content-type':'application/json'}:{}),...headers,...(context&&path!=='/auth/me'&&path!=='/auth/login'?{'x-ola-context':context}:{})},...(payload===undefined?{}:{body:payload})});
  const read=(r:Response)=>r.ok&&raw?r.blob():r.json().catch(()=>null);
  let response=await send(),value=await read(response);
  if(response.status===403&&value?.error?.code==='CSRF_REFUSED'&&context){
   // Only this explicit pre-handler rejection proves the mutation never ran.
   const fresh=await this.fetcher('/api/auth/me',{credentials:'same-origin'});
   const identity=await fresh.json().catch(()=>null);
   if(this.epoch!==epoch)throw new ApiError('会话已更新，请重新打开操作页面',403,'SESSION_CHANGED');
   if(!fresh.ok){if(fresh.status===401){this.clear();this.onExpired();}throw new ApiError(identity?.error?.message||'会话恢复失败，请重试',fresh.status,identity?.error?.code||'REQUEST_FAILED');}
   if(!identity?.user||!identity.csrf||sessionContext(identity.user)!==context){this.clear();this.onExpired();throw new ApiError('登录身份或企业已变化，请重新登录',403,'SESSION_CHANGED');}
   this.csrf=identity.csrf;response=await send();value=await read(response);
  }
  if(!response.ok){
   if(this.epoch===epoch&&((response.status===401&&path!=='/auth/login')||value?.error?.code==='SESSION_CHANGED')){this.clear();this.onExpired();}
   throw new ApiError(value?.error?.message||`请求失败（${response.status}）`,response.status,value?.error?.code||'REQUEST_FAILED');
  }
  return value as T;
 }
}
