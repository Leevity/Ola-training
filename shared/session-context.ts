export function sessionContext(user:{id:string;tenantId:string;memberId:string}){
 return `${user.id}:${user.tenantId}:${user.memberId}`;
}
