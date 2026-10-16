export type Audience={mode:'enterprise'|'departments'|'members';departments:string[];memberIds:string[]};
export const enterpriseAudience=():Audience=>({mode:'enterprise',departments:[],memberIds:[]});
export function sameAudience(a:Audience,b:Audience){return a.mode===b.mode&&JSON.stringify([...a.departments].sort())===JSON.stringify([...b.departments].sort())&&JSON.stringify([...a.memberIds].sort())===JSON.stringify([...b.memberIds].sort());}
export function audienceAllows(audience:Audience|undefined,member:{id?:string;memberId?:string;department:string}){
 if(!audience||audience.mode==='enterprise')return true;
 if(audience.mode==='departments')return audience.departments.includes(member.department);
 return audience.memberIds.includes(member.memberId||member.id||'');
}
