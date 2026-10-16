export class HttpError extends Error {constructor(public status:number,public code:string,message:string){super(message);}}
export const bad=(message:string)=>new HttpError(400,'INVALID_REQUEST',message);
export const forbidden=()=>new HttpError(403,'FORBIDDEN','没有此操作权限');
export const missing=()=>new HttpError(404,'NOT_FOUND','记录不存在或不可访问');
export const conflict=(message='数据已变化，请刷新后重试')=>new HttpError(409,'CONFLICT',message);
