export type KnowledgeDownload={path:string;filename:string;context:string};
export function knowledgeDownloadPath(id:string,course?:{courseId:string;version:number}){
 return `/learn/knowledge/${encodeURIComponent(id)}/download`+(course?`?courseId=${encodeURIComponent(course.courseId)}&version=${course.version}`:'');
}
export function filenameFromDisposition(header:string|null){
 let filename='学习资料';const encoded=header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
 if(encoded){try{filename=decodeURIComponent(encoded);}catch{/* Keep the safe fallback for invalid encoding. */}}
 else filename=header?.match(/filename="([^"]*)"/i)?.[1]||filename;
 filename=filename.split(/[\\/]/).pop()!.replace(/[\x00-\x1f\x7f]/g,'_').slice(0,200);
 return !filename||filename==='.'||filename==='..'?'学习资料':filename;
}
export function triggerBrowserDownload(file:{filename:string;blob:Blob}){
 const url=URL.createObjectURL(file.blob),link=document.createElement('a');
 link.href=url;link.download=file.filename;link.style.display='none';document.body.append(link);
 try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
}
