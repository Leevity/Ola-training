const returnPages=new Set(['/messages','/history','/my/history','/my/courses','/courses','/search','/favorites','/my/favorites','/tasks','/my/tasks','/my','/growth','/my/growth']);
function safeReturn(value:string|null):value is string {
 if(!value||value.length>1200||!value.startsWith('/')||/[\\#\u0000-\u0020]/.test(value))return false;
 const path=value.split('?')[0];
 return returnPages.has(path)||/^\/(task|course)\/[a-zA-Z0-9_-]{1,80}$/.test(path);
}
export function withReturnTo(destination:string,source:string){
 const route=source.replace(/^#/,'');
 if(!safeReturn(route)||!destination.startsWith('/')||destination.startsWith('//'))return destination;
 const [path,query='']=destination.split('?');const params=new URLSearchParams(query);
 params.set('returnTo',route);return path+'?'+params;
}
export function returnDestination(hash:string,fallback:string){
 const value=new URLSearchParams(hash.split('?')[1]||'').get('returnTo');
 return safeReturn(value)?value:fallback;
}
export function routeChoice(hash:string,key:string,allowed:readonly string[],fallback:string){
 const value=new URLSearchParams(hash.split('?')[1]||'').get(key);
 return value&&allowed.includes(value)?value:fallback;
}
export function choiceRoute(hash:string,changes:Record<string,string>){
 const [path,query='']=hash.replace(/^#/,'').split('?');const params=new URLSearchParams(query);
 for(const [key,value] of Object.entries(changes))params.set(key,value);
 return path+'?'+params;
}
