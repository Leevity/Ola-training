/** Structural diagnostics only: never retain model text, prompts, or arbitrary JSON keys. */
export function inspectWidgetOutput(response:string){
 const text=response.trim();
 let format:'html'|'json'|'markdown'|'text'='text',jsonHtml=false;
 if(/^<!doctype\s+html\b|^<html\b/i.test(text))format='html';
 else if(text.includes('```'))format='markdown';
 try{
  const value=JSON.parse(text);format='json';
  const nested=value&&typeof value==='object'?[value.html,value.content?.html,value.document?.html]:[];
  jsonHtml=nested.some(html=>typeof html==='string'&&/<html\b/i.test(html));
 }catch{/* Plain text is expected for the documented widget protocol. */}
 return {format,characters:response.length,htmlOpen:/<html\b/i.test(text),htmlClose:/<\/html\s*>/i.test(text),codeFence:text.includes('```'),jsonHtml};
}
