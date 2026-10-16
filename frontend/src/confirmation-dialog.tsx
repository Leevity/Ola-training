import {useEffect,useRef,type ReactNode} from 'react';

export function ConfirmationDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const dialog=ref.current!,previous=document.activeElement as HTMLElement|null;
  const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';dialog.showModal();
  return()=>{dialog.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};
 },[]);
 return <dialog ref={ref} className="mobile-dialog mobile-confirmation" aria-label={title} onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>{
  if(event.key!=='Tab')return;
  const controls=Array.from(ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(element=>element.getClientRects().length>0);
  const first=controls[0],last=controls[controls.length-1];
  if(!first){event.preventDefault();ref.current?.focus();}
  else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }}>{children}</dialog>;
}
