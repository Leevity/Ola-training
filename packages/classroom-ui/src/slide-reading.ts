import DOMPurify from 'dompurify';
import type { PPTElement } from '@openmaic/dsl';

/** Extract text boxes in visual reading order; never execute generated HTML. */
export function slideReadingText(elements: PPTElement[]): string[] {
  return [...elements].sort((a,b)=>(a.top||0)-(b.top||0)||(a.left||0)-(b.left||0)).flatMap(element=>{
    const html=element.type==='text'?element.content:element.type==='shape'?element.text?.content:undefined;
    if(!html)return [];
    const template=document.createElement('template');
    template.innerHTML=DOMPurify.sanitize(html);
    for(const node of template.content.querySelectorAll('br,p,div,li,h1,h2,h3,h4,h5,h6')){
      if(node.tagName==='BR')node.replaceWith('\n');else node.append('\n');
    }
    const text=(template.content.textContent||'').replace(/[\t ]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
    return text?[text]:[];
  });
}
