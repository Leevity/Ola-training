import {useEffect,useMemo,useRef,useState} from 'react';
import {sandboxHtml} from './safety';
import {widgetHeight} from './widget-height';

/** Only layout messages from this frame are accepted. No learner state or credentials cross the boundary. */
export function Widget({html,title}:{html:string;title:string}) {
 const frame=useRef<HTMLIFrameElement>(null);
 const [height,setHeight]=useState(460);
 const document=useMemo(()=>sandboxHtml(html),[html]);
 useEffect(()=>{
  setHeight(460);
  const resize=(event:MessageEvent)=>{
   if(!frame.current?.contentWindow||event.source!==frame.current.contentWindow)return;
   const next=widgetHeight(event.data);
   if(next!==undefined)setHeight(next);
  };
  window.addEventListener('message',resize);
  return()=>window.removeEventListener('message',resize);
 },[html]);
 return <iframe ref={frame} className="maic-widget" style={{height}} title={title} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={document}/>;
}
