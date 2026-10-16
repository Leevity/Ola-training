import type { Action } from '@openmaic/dsl';

/** Keep persisted action indexes compatible while navigating actual spoken paragraphs. */
export function teachingStep(actions: Action[], cursor: number) {
  const positions=actions.flatMap((action,index)=>action.type==='speech'&&action.text.trim()?[index]:[]);
  if(!positions.length)return null;
  let current=0;
  positions.forEach((position,index)=>{if(position<=cursor)current=index;});
  const start=current===0?0:positions[current],end=positions[current+1]??actions.length;
  const focus=actions.slice(start,end).filter(action=>action.type==='spotlight'||action.type==='laser').at(-1);
  return {number:current+1,total:positions.length,speech:actions[positions[current]] as Extract<Action,{type:'speech'}>,previous:positions[current-1],next:positions[current+1],focus};
}

export function replaceSpeechActions(actions:Action[],text:string,createId:()=>string):Action[]{
  const paragraphs=text.split(/\n\s*\n/).map(value=>value.trim()).filter(Boolean);
  let cursor=0;
  const next=actions.flatMap<Action>(action=>{
    if(action.type!=='speech')return [action];
    const paragraph=paragraphs[cursor++];
    return paragraph?[{...action,text:paragraph}]:[];
  });
  while(cursor<paragraphs.length)next.push({id:createId(),type:'speech',text:paragraphs[cursor++]});
  return next;
}
