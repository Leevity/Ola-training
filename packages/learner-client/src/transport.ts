import {sessionContext} from '../../../shared/session-context.ts';
type Identity={id:string;tenantId:string;memberId:string};
export class ApiError extends Error {
 public status:number;public code:string;
 constructor(message:string,status:number,code:string){super(message);this.status=status;this.code=code;}
}
export class LearnerTransport {
 public csrf='';public context='';
 constructor(privateOptions:{fetch?:typeof fetch;onExpired:()=>void},initial?:{csrf:string;context:string}){
  this.fetcher=privateOptions.fetch||((input,init)=>fetch(input,init));this.onExpired=privateOptions.onExpired;
  if(initial){this.csrf=initial.csrf;this.context=initial.context;}
 }
 private fetcher:typeof fetch;private onExpired:()=>void;
 private async fetchResponse(input:RequestInfo|URL,init?:RequestInit){
  try{return await this.fetcher(input,init);}
  catch(error){
   if((error as {name?:string})?.name==='AbortError')throw new ApiError('请求已取消，请重试',0,'REQUEST_CANCELLED');
   throw new ApiError('连接中断，请检查网络后重试。尚未确认保存成功前，请勿关闭当前页面。',0,'NETWORK_ERROR');
  }
 }
 setSession(user:Identity,csrf:string){this.context=sessionContext(user);this.csrf=csrf;}
 clear(){this.csrf='';this.context='';}
 async request<T>(path:string,method='GET',body?:unknown,kind:'json'|'response'='json'):Promise<T>{
  const context=this.context,payload=body===undefined?undefined:JSON.stringify(body);
  const send=()=>this.fetchResponse('/api'+path,{method,credentials:'same-origin',headers:{'x-ola-client':'learner',...(context&&path!=='/auth/me'&&path!=='/auth/login'?{'x-ola-context':context}:{}),...(payload!==undefined?{'content-type':'application/json'}:{}),...(!['GET','HEAD'].includes(method)?{'x-csrf-token':this.csrf}:{})},...(payload===undefined?{}:{body:payload})});
  const read=(response:Response)=>response.ok&&kind==='response'?Promise.resolve(response):response.json().catch(()=>null);
  let response=await send();let value=await read(response);
  if(response.status===403&&value?.error?.code==='CSRF_REFUSED'&&context){
   // The server rejected this request before executing any business mutation.
   const fresh=await this.fetchResponse('/api/auth/me',{credentials:'same-origin',headers:{'x-ola-client':'learner'}});
   const identity=await fresh.json().catch(()=>null);
   if(!fresh.ok){if(fresh.status===401){this.clear();this.onExpired();}throw new ApiError(identity?.error?.message||'会话恢复失败，请重新登录',fresh.status,identity?.error?.code||'REQUEST_FAILED');}
   if(!identity?.user||!identity.csrf||sessionContext(identity.user)!==context){this.clear();this.onExpired();throw new ApiError('登录身份或企业已变化，请重新进入学习空间',403,'SESSION_CHANGED');}
   this.csrf=identity.csrf;response=await send();value=await read(response);
  }
  if(!response.ok){if((response.status===401&&path!=='/auth/login')||value?.error?.code==='SESSION_CHANGED'){this.clear();this.onExpired();}throw new ApiError(value?.error?.message||'服务暂不可用，请重试',response.status,value?.error?.code||'REQUEST_FAILED');}
  return value as T;
 }
}
