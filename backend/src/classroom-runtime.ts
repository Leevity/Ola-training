import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Database } from './db.ts';
import { id } from './schemas.ts';
import { accessible } from './learning.ts';
import { bad, conflict, missing } from './errors.ts';

const stateSchema=z.object({actionIndex:z.number().int().min(0).max(10000),answers:z.record(z.string().max(128),z.array(z.string().max(10000)).max(12)),submitted:z.boolean(),notes:z.record(z.string().max(128),z.string().max(20000))}).refine(value=>Buffer.byteLength(JSON.stringify(value))<=100000,'课堂记录超过大小限制');
const initial=()=>({actionIndex:0,answers:{},submitted:false,notes:{}});
export async function registerClassroomRuntime(app:FastifyInstance,db:Database){
 const prefix='/api/learn/courses/:courseId/versions/:version/classroom/scenes/:sceneId/runtime';
 const coordinates=(params:any)=>({courseId:id.parse(params.courseId),version:z.coerce.number().int().positive().parse(params.version),sceneId:id.parse(params.sceneId)});
 app.get(prefix,async req=>{
  const a=req.actor!,p=coordinates(req.params);const course=await accessible(db,a,p.courseId,p.version);
  if(!course.classroom?.scenes.some((scene:any)=>scene.id===p.sceneId))throw missing();
  const row=(await db.query('SELECT revision,state FROM classroom_runtime WHERE tenant_id=$1 AND member_id=$2 AND course_id=$3 AND course_version=$4 AND scene_id=$5',[a.tenantId,a.memberId,p.courseId,p.version,p.sceneId])).rows[0];return row||{revision:0,state:initial()};
 });
 app.put(prefix,async req=>{
  const a=req.actor!,p=coordinates(req.params),input=z.object({eventId:id,revision:z.number().int().min(0),state:stateSchema}).parse(req.body),inputHash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return db.transaction(async tx=>{
   const course=await accessible(tx,a,p.courseId,p.version),scene=course.classroom?.scenes.find((scene:any)=>scene.id===p.sceneId);if(!scene)throw missing();
   const args=[a.tenantId,a.memberId,p.courseId,p.version,p.sceneId];
   // The member lock serializes initial row creation and event replay across concurrent devices.
   await tx.query('SELECT id FROM members WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[a.tenantId,a.memberId]);
   const prior=(await tx.query('SELECT * FROM classroom_runtime_events WHERE tenant_id=$1 AND member_id=$2 AND course_id=$3 AND course_version=$4 AND scene_id=$5 AND event_id=$6',[...args,input.eventId])).rows[0];
   if(prior){if(prior.input_hash!==inputHash)throw conflict('同一学习事件不能提交不同内容');return prior.result;}
   const row=(await tx.query('SELECT * FROM classroom_runtime WHERE tenant_id=$1 AND member_id=$2 AND course_id=$3 AND course_version=$4 AND scene_id=$5 FOR UPDATE',args)).rows[0];
   if((row?.revision||0)!==input.revision)throw conflict('另一设备已更新课堂记录，请重新加载后继续');
   if(scene.actions?.length&&input.state.actionIndex>=scene.actions.length)throw bad('讲解位置不存在');
   const questionIds=new Set((scene.type==='quiz'?scene.content.questions:[]).map((q:any)=>q.id));if(Object.keys(input.state.answers).some(q=>!questionIds.has(q)))throw bad('回答包含当前场景之外的题目');
   const revision=input.revision+1,result={revision,state:input.state};
   await tx.query('INSERT INTO classroom_runtime(tenant_id,member_id,course_id,course_version,scene_id,revision,state) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,member_id,course_id,course_version,scene_id) DO UPDATE SET revision=excluded.revision,state=excluded.state,updated_at=now()',[...args,revision,JSON.stringify(input.state)]);
   await tx.query('INSERT INTO classroom_runtime_events(tenant_id,member_id,course_id,course_version,scene_id,event_id,input_hash,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[...args,input.eventId,inputHash,JSON.stringify(result)]);return result;
  });
 });
}
