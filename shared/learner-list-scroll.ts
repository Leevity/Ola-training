const positions=new Map<string,number>();
/** Scope includes the member and enterprise; only this unchanged list route records scroll events. */
export function keepListScroll(scope:string){
 const route=location.hash,key=scope+':'+route;
 const frame=requestAnimationFrame(()=>window.scrollTo(0,positions.get(key)||0));
 const remember=()=>{
  if(location.hash!==route)return;
  positions.delete(key);positions.set(key,window.scrollY);
  if(positions.size>64)positions.delete(positions.keys().next().value!);
 };
 window.addEventListener('scroll',remember,{passive:true});
 return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',remember);};
}
