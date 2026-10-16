/** Refresh an open learner workspace when returning from another client. */
export function watchLearningRefresh(refresh:()=>Promise<unknown>,onError:(error:unknown)=>void){
 let active=true,pending=false,again=false;
 const reload=async()=>{
  if(!active)return;
  if(pending){again=true;return;}
  pending=true;
  try{await refresh();}catch(error){if(active)onError(error);}finally{pending=false;if(again&&active){again=false;void reload();}}
 };
 const changed=()=>{void reload();};
 const visible=()=>{if(document.visibilityState==='visible')changed();};
 window.addEventListener('focus',changed);window.addEventListener('hashchange',changed);document.addEventListener('visibilitychange',visible);
 const timer=window.setInterval(visible,30000);
 return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',changed);window.removeEventListener('hashchange',changed);document.removeEventListener('visibilitychange',visible);};
}
