import {useEffect,useRef,useState} from 'react';

export function useDiscardConfirmation(){
 const [pending,setPending]=useState<{action:()=>void;description:string;label:string}|null>(null);
 const previous=useRef<HTMLElement|null>(null),continueRef=useRef<HTMLButtonElement>(null),wasPending=useRef(false);
 useEffect(()=>{if(pending)continueRef.current?.focus();else if(wasPending.current&&previous.current?.isConnected)previous.current.focus();wasPending.current=Boolean(pending);},[pending]);
 const cancel=()=>setPending(null);
 useEffect(()=>{if(!pending)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&continueRef.current&&!continueRef.current.matches(':disabled')){event.preventDefault();event.stopImmediatePropagation();cancel();}};document.addEventListener('keydown',key,true);return()=>document.removeEventListener('keydown',key,true);},[pending]);
 const request=(dirty:boolean,action:()=>void,description:string,label='放弃修改并继续')=>{
  if(!dirty){action();return;}
  previous.current=document.activeElement as HTMLElement;
  setPending({action,description,label});
 };
 const confirmation=pending?<div className="discard-confirmation" role="alert"><p>{pending.description}</p><div className="title-actions"><button ref={continueRef} type="button" className="button" onClick={cancel}>继续编辑</button><button type="button" className="button" onClick={()=>{const action=pending.action;setPending(null);action();}}>{pending.label}</button></div></div>:null;
 return {pending:Boolean(pending),request,cancel,confirmation};
}
