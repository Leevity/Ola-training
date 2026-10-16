import type { Actor } from './auth.ts';
import type { Queryable } from './db.ts';
import type { Audience } from '../../shared/audience.ts';
import { audienceAllows } from '../../shared/audience.ts';
import { bad } from './errors.ts';
export function courseVisible(a:Actor,course:{tenantId?:string;audience?:Audience}){return (!course.tenantId||course.tenantId===a.tenantId)&&audienceAllows(course.audience,a);}
export async function validateAudience(tx:Queryable,tenantId:string,audience:Audience){
 if(new Set(audience.memberIds).size!==audience.memberIds.length||new Set(audience.departments).size!==audience.departments.length)throw bad('可见范围不能重复');
 const tenant=(await tx.query('SELECT departments FROM tenants WHERE id=$1',[tenantId])).rows[0];
 if(audience.departments.some(department=>!tenant.departments.includes(department)))throw bad('可见部门不存在');
 for(const memberId of audience.memberIds)if(!(await tx.query('SELECT 1 FROM members WHERE tenant_id=$1 AND id=$2',[tenantId,memberId])).rows.length)throw bad('可见成员不存在或不属于本企业');
}
/** A file is visible through its own audience or an accessible course/version that explicitly references it. */
export async function knowledgeVisible(tx:Queryable,a:Actor,knowledge:{id:string;audience?:Audience}){
 if(audienceAllows(knowledge.audience,a))return true;
 const rows=(await tx.query(`SELECT DISTINCT v.course_id,v.version FROM course_versions v JOIN courses c ON c.tenant_id=v.tenant_id AND c.id=v.course_id
  WHERE v.tenant_id=$1 AND v.content->'knowledgeIds' ? $2 AND ((c.status='published' AND c.version=v.version) OR EXISTS(
  SELECT 1 FROM task_items i JOIN tasks t ON t.tenant_id=i.tenant_id AND t.id=i.task_id JOIN assignments x ON x.tenant_id=i.tenant_id AND x.task_id=i.task_id
  WHERE i.tenant_id=v.tenant_id AND i.course_id=v.course_id AND i.course_version=v.version AND x.member_id=$3 AND t.status='published' AND t.start_date<=CURRENT_DATE AND t.due_date>=CURRENT_DATE))`,[a.tenantId,knowledge.id,a.memberId])).rows;
 const {accessible}=await import('./learning.ts');
 for(const row of rows){try{await accessible(tx,a,row.course_id,row.version);return true;}catch(e){if(![403,404].includes((e as any).status))throw e;}}
 return false;
}
