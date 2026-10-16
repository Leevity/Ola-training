import {assetMediaUrl} from '../../../shared/course-assets.ts';
import DOMPurify from 'dompurify';
import { validateScene, type Scene, type InteractiveContent, type PBLContent, type SceneContent } from '@openmaic/dsl';
export type ClassroomScene=Scene<import('@openmaic/dsl').Action,SceneContent|InteractiveContent|PBLContent>;

export function safeMedia(value:unknown,client:'admin'|'learner'='learner'):string|undefined {
 if(typeof value!=='string')return undefined;
 if(value.startsWith('/')&&!value.startsWith('//'))return assetMediaUrl(value,client);
 if(/^https:\/\//i.test(value)||/^blob:/i.test(value))return value;
 if(/^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(value)&&value.length<2*1024*1024)return value;
 return undefined;
}
export function safeHtml(value:string,client:'admin'|'learner'='learner'){
 const result=DOMPurify.sanitize(value,{FORBID_TAGS:['script','style','iframe','object','embed','form','input','button','link','meta','base'],FORBID_ATTR:['srcdoc'],ALLOW_DATA_ATTR:true});
 const fragment=document.createElement('template');fragment.innerHTML=result;
 const safeProperties=/^(font(-size|-family|-weight|-style)?|text(-align|-decoration|-indent)?|color|background-color|line-height|letter-spacing|vertical-align|white-space|width|height|min-width|max-width|margin(-top|-bottom|-left|-right)?|padding(-top|-bottom|-left|-right)?|border(-color|-width|-style|-radius)?)$/;
 for(const node of fragment.content.querySelectorAll<HTMLElement>('[style]'))for(const property of Array.from(node.style)){
  if(!safeProperties.test(property)||/url\s*\(|expression\s*\(|@import/i.test(node.style.getPropertyValue(property)))node.style.removeProperty(property);
 }
 for(const image of fragment.content.querySelectorAll<HTMLImageElement>('img')){const src=safeMedia(image.getAttribute('src'),client);if(src)image.src=src;else image.removeAttribute('src');}
 for(const anchor of fragment.content.querySelectorAll<HTMLAnchorElement>('a')){anchor.removeAttribute('href');anchor.removeAttribute('target');}
 return fragment.innerHTML;
}
export function cleanScene(value:unknown,client:'admin'|'learner'='learner'):ClassroomScene|null {
 if(!validateScene(value).valid)return null;
 const clone=structuredClone(value) as ClassroomScene;
 const clean=(value:any):any=>{
  if(Array.isArray(value))return value.map(clean);
  if(!value||typeof value!=='object')return value;
  for(const key of Object.keys(value)){
   if(['src','url','poster'].includes(key)&&typeof value[key]==='string')value[key]=safeMedia(value[key],client)||'';
   else if(['content','label','textContent'].includes(key)&&typeof value[key]==='string')value[key]=safeHtml(value[key],client);
   else if(key==='hyperlink')delete value[key];
   else if(key!=='html')value[key]=clean(value[key]);
  }return value;
 };
 return clean(clone);
}
export function sandboxHtml(html:string){
 const policy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";
 // Put CSP before generated content; sandbox grants scripts only and keeps an opaque origin.
 return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`;
}
