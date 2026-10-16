import { randomUUID } from 'node:crypto';
import type { Course, Knowledge, Member, Task, Tenant } from '../../shared/domain.ts';
import type { Queryable, Database, Row } from './db.ts';
import type { Actor } from './auth.ts';
import { conflict, missing } from './errors.ts';
export const iso=(v:any)=>v instanceof Date?v.toISOString():String(v);
export const mapTenant=(r:Row):Tenant=>({id:r.id,name:r.name,shortName:r.short_name,description:r.description,departments:r.departments});
export const mapCourse=(r:Row):Course=>({...r.data,id:r.id,tenantId:r.tenant_id,title:r.title,kind:r.kind,category:r.category,status:r.status,version:r.version,updatedAt:iso(r.updated_at)});
export const mapMember=(r:Row):Member&{email?:string}=>({id:r.id,tenantId:r.tenant_id,name:r.name,employeeNo:r.employee_no,department:r.department,role:r.role,active:r.active,...(r.email?{email:r.email}:{})});
export const mapKnowledge=(r:Row):Knowledge=>{
 // Parsing claims expire after the same three-minute lease used by the parser route.
 const parsing=Boolean(r.parse_token&&r.parse_started_at&&new Date(r.parse_started_at).getTime()+180000>Date.now());
 const interrupted=Boolean(r.parse_token&&!parsing);
 return {id:r.id,tenantId:r.tenant_id,name:r.name,category:r.category,size:Number(r.size),mime:r.mime,status:r.status,text:r.text_content??undefined,hasBlob:Boolean(r.file_key),updatedAt:iso(r.updated_at),parseError:r.parse_error||(interrupted?'上次解析未完成，可重新解析':undefined),parsing,pageCount:r.parse_units?.length||undefined,audience:r.audience};
};
export async function getCourse(tx:Queryable,tenantId:string,id:string){const r=(await tx.query('SELECT * FROM courses WHERE tenant_id=$1 AND id=$2',[tenantId,id])).rows[0];if(!r)throw missing();return mapCourse(r);}
export async function getMember(tx:Queryable,tenantId:string,id:string){const r=(await tx.query('SELECT * FROM members WHERE tenant_id=$1 AND id=$2',[tenantId,id])).rows[0];if(!r)throw missing();return mapMember(r);}
export async function getKnowledge(tx:Queryable,tenantId:string,id:string){const r=(await tx.query('SELECT * FROM knowledge WHERE tenant_id=$1 AND id=$2',[tenantId,id])).rows[0];if(!r)throw missing();return r;}
export async function listTasks(tx:Queryable,tenantId:string):Promise<Task[]>{
  const tasks=(await tx.query('SELECT *,start_date::text AS start_text,due_date::text AS due_text FROM tasks WHERE tenant_id=$1 ORDER BY assigned_at DESC NULLS LAST,id',[tenantId])).rows;
  const items=(await tx.query('SELECT i.*,v.content FROM task_items i LEFT JOIN course_versions v ON v.tenant_id=i.tenant_id AND v.course_id=i.course_id AND v.version=i.course_version WHERE i.tenant_id=$1 ORDER BY position',[tenantId])).rows;
  const assignments=(await tx.query('SELECT * FROM assignments WHERE tenant_id=$1 ORDER BY member_id',[tenantId])).rows;
  return tasks.map(t=>({id:t.id,tenantId,title:t.title,description:t.description,start:t.start_text,due:t.due_text,status:t.status,sequential:t.sequential,assignedAt:t.assigned_at?iso(t.assigned_at):undefined,courseIds:items.filter(i=>i.task_id===t.id).map(i=>i.course_id),memberIds:assignments.filter(a=>a.task_id===t.id).map(a=>a.member_id),completedMemberIds:assignments.filter(a=>a.task_id===t.id&&a.completed_at).map(a=>a.member_id),snapshot:items.filter(i=>i.task_id===t.id&&i.content).map(i=>({id:i.course_id,title:i.content.title,kind:i.content.kind,version:i.course_version}))}));
}
export async function bootstrap(db:Database,a:Actor){return db.transaction(async tx=>{
  const current=(await tx.query('SELECT * FROM tenants WHERE id=$1 FOR SHARE',[a.tenantId])).rows[0];if(!current)throw missing();
  const tenants=(await tx.query('SELECT t.* FROM tenants t JOIN members m ON m.tenant_id=t.id WHERE m.account_id=$1 AND m.active=TRUE ORDER BY t.id',[a.accountId])).rows.map(mapTenant);
  const courses=(await tx.query('SELECT * FROM courses WHERE tenant_id=$1 ORDER BY updated_at DESC,id',[a.tenantId])).rows.map(mapCourse);
  const members=(await tx.query('SELECT m.*,a.email FROM members m LEFT JOIN accounts a ON a.id=m.account_id WHERE tenant_id=$1 ORDER BY employee_no',[a.tenantId])).rows.map(mapMember);
  const knowledge=(await tx.query('SELECT * FROM knowledge WHERE tenant_id=$1 ORDER BY updated_at DESC',[a.tenantId])).rows.map(mapKnowledge);
  const audit=(await tx.query('SELECT id,tenant_id AS "tenantId",action,target,created_at FROM audit_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 500',[a.tenantId])).rows.map(r=>({id:r.id,tenantId:r.tenantId,action:r.action,target:r.target,at:iso(r.created_at)}));
  return {db:{schemaVersion:1 as const,tenants,courses,members,knowledge,tasks:await listTasks(tx,a.tenantId),audit},revision:current.revision};
});}
export async function mutate<T>(db:Database,a:Actor,expected:unknown,action:string,target:string,fn:(tx:Queryable)=>Promise<T>){
 return db.transaction(async tx=>{
  const row=(await tx.query('SELECT revision FROM tenants WHERE id=$1 FOR UPDATE',[a.tenantId])).rows[0];if(!row)throw missing();
  if(expected!==undefined&&String(expected).replaceAll('"','')!==String(row.revision))throw conflict();
  const result=await fn(tx);
  await tx.query('UPDATE tenants SET revision=revision+1 WHERE id=$1',[a.tenantId]);
  await tx.query('INSERT INTO audit_logs(id,tenant_id,actor_id,action,target) VALUES($1,$2,$3,$4,$5)',[randomUUID(),a.tenantId,a.accountId,action,target.slice(0,1000)]);
  return result;
 });
}
