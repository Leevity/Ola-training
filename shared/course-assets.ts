const pattern=/\/api\/(?:admin|learn)\/course-assets\/([a-zA-Z0-9_-]{1,128})(?![a-zA-Z0-9_-])/g;
export function courseAssetIds(value:unknown){const ids=new Set<string>();const walk=(item:unknown)=>{if(typeof item==='string'){for(const match of item.matchAll(pattern))ids.add(match[1]);}else if(Array.isArray(item))item.forEach(walk);else if(item&&typeof item==='object')Object.values(item).forEach(walk);};walk(value);return [...ids];}
export function assetMediaUrl(value:string,client:'admin'|'learner'='learner'){return value.replace(pattern,(_,id)=>`/api/${client==='admin'?'admin':'learn'}/course-assets/${id}`);}
export function normalizeAssetDocument<T>(value:T):T{
 if(typeof value==='string')return assetMediaUrl(value) as T;
 if(Array.isArray(value))return value.map(item=>normalizeAssetDocument(item)) as T;
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,normalizeAssetDocument(item)])) as T;
 return value;
}
