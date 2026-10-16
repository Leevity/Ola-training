import {validateCourseAssets} from './course-assets.ts';
import {sameAudience,enterpriseAudience} from '../../shared/audience.ts';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { validateCourse, validateTask, type Course, type Member } from '../../shared/domain.ts';
import { accountInput, courseInput, memberInput, taskInput, tenantInput, questionInput, id } from './schemas.ts';
import { bootstrap, getCourse, getKnowledge, getMember, iso, listTasks, mapCourse, mapKnowledge, mutate } from './store.ts';
import { hashPassword, requireAdmin, requireContent, requireStaff, requireTenant } from './auth.ts';
import { bad, conflict, forbidden, missing } from './errors.ts';
import type { Database, Queryable } from './db.ts';
import type { Config } from './config.ts';
import { reconcileTaskAssignments } from './learning.ts';
import { audienceSchema } from './schemas.ts';
import { courseVisible, validateAudience } from './content-access.ts';
const prefix='/api/tenants/:tenantId';
const resourceId=(req:FastifyRequest)=>id.parse((req.params as any).id);
const unique=(values:string[])=>new Set(values).size===values.length;
async function assertRefs(tx:Queryable,tenantId:string,table:'courses'|'members'|'knowledge',ids:string[]){
  if(!unique(ids))throw bad('关联记录不能重复');
  for(const ref of ids){if(!(await tx.query(`SELECT 1 FROM ${table} WHERE tenant_id=$1 AND id=$2`,[tenantId,ref])).rows.length)throw bad('关联记录不存在或不属于本企业');}
}
export async function registerAdmin(app:FastifyInstance,db:Database,config:Config){
 app.get(`${prefix}/content-directory`,async req=>{const a=requireTenant(req);requireContent(a);return {items:(await db.query('SELECT id,name,department,active FROM members WHERE tenant_id=$1 ORDER BY name',[a.tenantId])).rows};});
 app.get('/api/bootstrap',async req=>{requireStaff(req.actor!);const result=await bootstrap(db,req.actor!);if(req.actor!.role==='内容作者'){result.db.members=[];result.db.tasks=[];result.db.audit=[];}if(req.actor!.role==='部门管理员'){const own=result.db.members.filter(m=>m.department===req.actor!.department);const ids=new Set(own.map(m=>m.id));result.db.members=own;result.db.tasks=result.db.tasks.filter(t=>t.memberIds.some(id=>ids.has(id))).map(t=>({...t,memberIds:t.memberIds.filter(id=>ids.has(id)),completedMemberIds:t.completedMemberIds.filter(id=>ids.has(id))}));result.db.audit=[];}return result;});
 app.get(`${prefix}/courses`,async req=>{const a=requireTenant(req);requireStaff(a);return {items:(await db.query('SELECT * FROM courses WHERE tenant_id=$1 ORDER BY updated_at DESC',[a.tenantId])).rows.map(mapCourse)};});
 app.get(`${prefix}/courses/:id`,async req=>{const a=requireTenant(req);requireStaff(a);return getCourse(db,a.tenantId,resourceId(req));});
 app.get(`${prefix}/courses/:id/versions`,async req=>{const a=requireTenant(req);requireContent(a);await getCourse(db,a.tenantId,resourceId(req));return {items:(await db.query('SELECT version,content,published_at FROM course_versions WHERE tenant_id=$1 AND course_id=$2 ORDER BY version DESC',[a.tenantId,resourceId(req)])).rows};});
 const saveCourse=async(req:FastifyRequest,create:boolean)=>{
  const a=requireTenant(req);requireContent(a);const input=courseInput.extend({publish:z.boolean().default(false)}).parse(req.body);const courseId=create?(input.id||randomUUID()):resourceId(req);
  return mutate(db,a,req.headers['if-match'],input.publish?'发布课程':'保存课程',input.title,async tx=>{
    const prior=(await tx.query('SELECT * FROM courses WHERE tenant_id=$1 AND id=$2',[a.tenantId,courseId])).rows[0];
    if(create&&prior)throw conflict('课程ID已存在');if(!create&&!prior)throw missing();if(prior?.status==='archived')throw bad('请先恢复归档课程');
    await assertRefs(tx,a.tenantId,'knowledge',input.knowledgeIds);
    await validateAudience(tx,a.tenantId,input.audience);
    if(input.publish&&input.audience.mode!=='enterprise'&&!(input.audience.mode==='members'?input.audience.memberIds:input.audience.departments).length)throw bad('发布课程前请选择可见成员或部门');
    const knowledge=(await tx.query('SELECT * FROM knowledge WHERE tenant_id=$1',[a.tenantId])).rows.map(mapKnowledge);
    const version=prior?(prior.status==='published'?prior.version+1:prior.version):1;
    const value:Course={...input,id:courseId,tenantId:a.tenantId,status:input.publish?'published':'draft',version,updatedAt:new Date().toISOString()};
    if(value.lessons.some(lesson=>lesson.format==='AI课堂')){
      if(value.kind!=='learn'||!value.classroom)throw bad('AI 课堂课时必须关联完整学习课堂文档');
      const scenes=value.classroom.scenes as {id:string}[];
      if(value.lessons.some(lesson=>lesson.format==='AI课堂'&&!scenes.some(scene=>scene.id===lesson.content&&scene.id===lesson.id)))throw bad('课堂课时和场景引用不一致');
    }
    const assets=await validateCourseAssets(tx,a.tenantId,courseId,value.classroom);if(value.classroom)value.classroom=assets.document as typeof value.classroom;
    const error=validateCourse(value,knowledge,input.publish);if(error)throw bad(error);
    await tx.query(`INSERT INTO courses(id,tenant_id,title,kind,category,status,version,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,kind=EXCLUDED.kind,category=EXCLUDED.category,status=EXCLUDED.status,version=EXCLUDED.version,data=EXCLUDED.data,updated_at=now() WHERE courses.tenant_id=EXCLUDED.tenant_id`,[courseId,a.tenantId,value.title,value.kind,value.category,value.status,version,JSON.stringify(value)]);
    if(!(await tx.query('SELECT 1 FROM courses WHERE id=$1 AND tenant_id=$2',[courseId,a.tenantId])).rows.length)throw conflict('无法创建课程');
    await tx.query('DELETE FROM course_knowledge WHERE tenant_id=$1 AND course_id=$2',[a.tenantId,courseId]);
    for(const knowledgeId of input.knowledgeIds)await tx.query('INSERT INTO course_knowledge(tenant_id,course_id,knowledge_id) VALUES($1,$2,$3)',[a.tenantId,courseId,knowledgeId]);
    if(input.publish){const questionRows=value.kind==='exam'?(await tx.query('SELECT data FROM questions WHERE tenant_id=$1 AND course_id=$2 ORDER BY id',[a.tenantId,courseId])).rows.map(r=>r.data).filter(q=>q.active!==false):[];if(value.kind==='exam'&&(!questionRows.length||questionRows.reduce((sum,q)=>sum+q.points,0)!==100))throw bad('发布考试前请配置启用试题，分值合计必须为100分');const content={...value,questions:questionRows};await tx.query('INSERT INTO course_versions(tenant_id,course_id,version,content) VALUES($1,$2,$3,$4)',[a.tenantId,courseId,version,JSON.stringify(content)]);for(const assetId of assets.ids)await tx.query('INSERT INTO course_asset_refs(tenant_id,course_id,course_version,asset_id) VALUES($1,$2,$3,$4)',[a.tenantId,courseId,version,assetId]);}
    return value;
  });
 };
 app.post(`${prefix}/courses`,req=>saveCourse(req,true));app.put(`${prefix}/courses/:id`,req=>saveCourse(req,false));
 app.post(`${prefix}/courses/:id/archive`,async req=>{const a=requireTenant(req);requireContent(a);const c=await getCourse(db,a.tenantId,resourceId(req));return mutate(db,a,req.headers['if-match'],'归档课程',c.title,async tx=>{if((await tx.query(`SELECT 1 FROM task_items i JOIN tasks t ON t.id=i.task_id AND t.tenant_id=i.tenant_id WHERE i.tenant_id=$1 AND i.course_id=$2 AND t.status='published' LIMIT 1`,[a.tenantId,c.id])).rows.length)throw conflict('课程已被已发布任务引用，请先归档对应任务');await tx.query("UPDATE courses SET status='archived',updated_at=now() WHERE tenant_id=$1 AND id=$2",[a.tenantId,c.id]);return {ok:true};});});
 app.post(`${prefix}/courses/:id/restore`,async req=>{const a=requireTenant(req);requireContent(a);const c=await getCourse(db,a.tenantId,resourceId(req));return mutate(db,a,req.headers['if-match'],'恢复课程',c.title,async tx=>{const c=await getCourse(tx,a.tenantId,resourceId(req));if(c.status!=='archived')throw bad('课程未归档');const used=(await tx.query('SELECT 1 FROM course_versions WHERE tenant_id=$1 AND course_id=$2 AND version=$3',[a.tenantId,c.id,c.version])).rows.length;await tx.query("UPDATE courses SET status='draft',version=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2",[a.tenantId,c.id,c.version+(used?1:0)]);return {ok:true};});});
 app.get(`${prefix}/tasks`,async req=>{const a=requireTenant(req);requireAdmin(a);return {items:await listTasks(db,a.tenantId)};});
 const saveTask=async(req:FastifyRequest,create:boolean)=>{
  const a=requireTenant(req);requireAdmin(a);const input=taskInput.safeExtend({publish:z.boolean().default(false)}).parse(req.body);const taskId=create?(input.id||randomUUID()):resourceId(req);
  return mutate(db,a,req.headers['if-match'],input.publish?'发布并分配任务':'保存任务',input.title,async tx=>{
    const prior=(await tx.query('SELECT * FROM tasks WHERE tenant_id=$1 AND id=$2',[a.tenantId,taskId])).rows[0];if(create&&prior)throw conflict('任务ID已存在');if(!create&&!prior)throw missing();if(prior&&prior.status!=='draft')throw bad('已发布或已归档任务不可原地修改，请复制新任务');
    await assertRefs(tx,a.tenantId,'courses',input.courseIds);await assertRefs(tx,a.tenantId,'members',input.memberIds);
    const courses=(await tx.query('SELECT * FROM courses WHERE tenant_id=$1',[a.tenantId])).rows.map(mapCourse);const members=(await tx.query('SELECT id,tenant_id,active,department FROM members WHERE tenant_id=$1',[a.tenantId])).rows.map(r=>({id:r.id,tenantId:r.tenant_id,active:r.active,department:r.department})) as Member[];
    const error=validateTask({...input,id:taskId,tenantId:a.tenantId,status:'draft',snapshot:[],completedMemberIds:[]},courses,members,input.publish);if(error)throw bad(error);
    if(input.publish)for(const courseId of input.courseIds)for(const memberId of input.memberIds){const course=courses.find(c=>c.id===courseId)!;const member=members.find(m=>m.id===memberId)!;if(!courseVisible({...a,memberId:member.id,department:member.department},course))throw bad('任务接收成员不在课程可见范围内');}
    const status=input.publish?'published':'draft';await tx.query(`INSERT INTO tasks(id,tenant_id,title,description,start_date,due_date,sequential,status,assigned_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,start_date=EXCLUDED.start_date,due_date=EXCLUDED.due_date,sequential=EXCLUDED.sequential,status=EXCLUDED.status,assigned_at=EXCLUDED.assigned_at WHERE tasks.tenant_id=EXCLUDED.tenant_id`,[taskId,a.tenantId,input.title,input.description,input.start,input.due,input.sequential,status,input.publish?new Date():null]);
    if(!(await tx.query('SELECT 1 FROM tasks WHERE id=$1 AND tenant_id=$2',[taskId,a.tenantId])).rows.length)throw conflict('无法创建任务');
    await tx.query('DELETE FROM task_items WHERE tenant_id=$1 AND task_id=$2',[a.tenantId,taskId]);await tx.query('DELETE FROM assignments WHERE tenant_id=$1 AND task_id=$2',[a.tenantId,taskId]);
    for(const [position,courseId] of input.courseIds.entries()){const c=courses.find(c=>c.id===courseId)!;await tx.query('INSERT INTO task_items(tenant_id,task_id,course_id,course_version,position) VALUES($1,$2,$3,$4,$5)',[a.tenantId,taskId,courseId,input.publish?c.version:null,position]);}
    for(const memberId of input.memberIds)await tx.query('INSERT INTO assignments(tenant_id,task_id,member_id) VALUES($1,$2,$3)',[a.tenantId,taskId,memberId]);
    if(input.publish)await reconcileTaskAssignments(tx,a.tenantId,taskId);
    return (await listTasks(tx,a.tenantId)).find(t=>t.id===taskId);
  });
 };
 app.post(`${prefix}/tasks`,req=>saveTask(req,true));app.put(`${prefix}/tasks/:id`,req=>saveTask(req,false));
 app.post(`${prefix}/tasks/:id/archive`,async req=>{const a=requireTenant(req);requireAdmin(a);return mutate(db,a,req.headers['if-match'],'归档任务',resourceId(req),async tx=>{const r=await tx.query("UPDATE tasks SET status='archived' WHERE tenant_id=$1 AND id=$2 RETURNING id",[a.tenantId,resourceId(req)]);if(!r.rows.length)throw missing();return {ok:true};});});
 app.get(`${prefix}/members`,async req=>{const a=requireTenant(req);requireAdmin(a);return {items:(await bootstrap(db,a)).db.members};});
 const saveMember=async(req:FastifyRequest,create:boolean)=>{
  const a=requireTenant(req);requireAdmin(a);const input=memberInput.parse(req.body);const memberId=create?(input.id||randomUUID()):resourceId(req);
  return mutate(db,a,req.headers['if-match'],'保存成员',input.name,async tx=>{
    const prior=(await tx.query('SELECT * FROM members WHERE tenant_id=$1 AND id=$2',[a.tenantId,memberId])).rows[0];if(create&&prior)throw conflict('成员ID已存在');if(!create&&!prior)throw missing();
    const t=(await tx.query('SELECT departments FROM tenants WHERE id=$1',[a.tenantId])).rows[0];if(!t.departments.includes(input.department))throw bad('所属部门不存在');
    if((await tx.query('SELECT 1 FROM members WHERE tenant_id=$1 AND employee_no=$2 AND id<>$3',[a.tenantId,input.employeeNo,memberId])).rows.length)throw conflict('本企业员工编号已存在');
    if(prior?.role==='企业管理员'&&prior.account_id&&(!input.active||input.role!=='企业管理员')){const admins=(await tx.query("SELECT count(*)::int AS count FROM members WHERE tenant_id=$1 AND active=TRUE AND role='企业管理员' AND account_id IS NOT NULL",[a.tenantId])).rows[0].count;if(admins<=1)throw conflict('不能停用或降级最后一名可登录企业管理员');}
    await tx.query(`INSERT INTO members(id,tenant_id,name,employee_no,department,role,active) VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,employee_no=EXCLUDED.employee_no,department=EXCLUDED.department,role=EXCLUDED.role,active=EXCLUDED.active WHERE members.tenant_id=EXCLUDED.tenant_id`,[memberId,a.tenantId,input.name,input.employeeNo,input.department,input.role,input.active]);
    if(!input.active&&prior?.account_id)await tx.query('DELETE FROM sessions WHERE account_id=$1 AND tenant_id=$2',[prior.account_id,a.tenantId]);
    return getMember(tx,a.tenantId,memberId);
  });
 };
 app.post(`${prefix}/members`,req=>saveMember(req,true));app.put(`${prefix}/members/:id`,req=>saveMember(req,false));
 app.post(`${prefix}/members/:id/account`,async req=>{const a=requireTenant(req);requireAdmin(a);const input=accountInput.parse(req.body);const hash=await hashPassword(input.password);return mutate(db,a,req.headers['if-match'],'开通登录账号',resourceId(req),async tx=>{const m=(await tx.query('SELECT * FROM members WHERE tenant_id=$1 AND id=$2',[a.tenantId,resourceId(req)])).rows[0];if(!m)throw missing();if(m.account_id)throw conflict('成员已有登录账号');if(!m.active)throw bad('请先启用成员');if((await tx.query('SELECT 1 FROM accounts WHERE email=$1',[input.email])).rows.length)throw conflict('此邮箱已有账号，请使用其他邮箱');const accountId=randomUUID();await tx.query('INSERT INTO accounts(id,email,password_hash) VALUES($1,$2,$3)',[accountId,input.email,hash]);await tx.query('UPDATE members SET account_id=$1 WHERE tenant_id=$2 AND id=$3',[accountId,a.tenantId,m.id]);return {email:input.email};});});
 app.put(`${prefix}/settings`,async req=>{const a=requireTenant(req);requireAdmin(a);const input=tenantInput.parse(req.body);return mutate(db,a,req.headers['if-match'],'更新企业设置',input.name,async tx=>{const departments=[...new Set(input.departments)];const members=(await tx.query('SELECT department FROM members WHERE tenant_id=$1',[a.tenantId])).rows;if(members.some(m=>!departments.includes(m.department)))throw conflict('待移除部门仍有成员，请先调整成员部门');await tx.query('UPDATE tenants SET name=$1,short_name=$2,description=$3,departments=$4 WHERE id=$5',[input.name,input.shortName,input.description,JSON.stringify(departments),a.tenantId]);return {ok:true};});});
 app.post('/api/platform/tenants',async req=>{const a=req.actor!;if(!a.platformAdmin)throw forbidden();const input=tenantInput.parse(req.body);const tenantId=randomUUID();await db.transaction(async tx=>{await tx.query('INSERT INTO tenants(id,name,short_name,description,departments) VALUES($1,$2,$3,$4,$5)',[tenantId,input.name,input.shortName,input.description,JSON.stringify(input.departments)]);await tx.query('INSERT INTO members(id,tenant_id,account_id,name,employee_no,department,role) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),tenantId,a.accountId,a.name,'ADMIN',input.departments[0],'企业管理员']);await tx.query('INSERT INTO audit_logs(id,tenant_id,actor_id,action,target) VALUES($1,$2,$3,$4,$5)',[randomUUID(),tenantId,a.accountId,'开通企业',input.name]);});return {id:tenantId};});
 app.get(`${prefix}/knowledge`,async req=>{const a=requireTenant(req);requireContent(a);return {items:(await db.query('SELECT * FROM knowledge WHERE tenant_id=$1 ORDER BY updated_at DESC',[a.tenantId])).rows.map(mapKnowledge)};});
 app.post(`${prefix}/knowledge`,async req=>{
  const a=requireTenant(req);requireContent(a);const file=await req.file();if(!file)throw bad('请选择文件');const buffer=await file.toBuffer();const name=file.filename.split(/[\\/]/).pop()!.slice(0,200);const extension=name.split('.').pop()?.toLowerCase();if(!extension||!['pdf','docx','pptx','txt','md'].includes(extension))throw bad('仅支持PDF、DOCX、PPTX、TXT、MD');
  if(extension==='pdf'&&!buffer.subarray(0,5).equals(Buffer.from('%PDF-')))throw bad('PDF文件格式不正确');if(['docx','pptx'].includes(extension)&&buffer.subarray(0,2).toString()!=='PK')throw bad('Office文件格式不正确');
  const category=z.string().trim().min(1).max(80).parse((file.fields.category as any)?.value||'业务资料');const fileId=randomUUID();const key=`${a.tenantId}/${fileId}`;const filename=join(config.dataDir,'files',key);await mkdir(join(config.dataDir,'files',a.tenantId),{recursive:true});
  let text:string|null=null;if(['txt','md'].includes(extension)){try{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{throw bad('文本文件须为UTF-8编码');}if(text.length>500000)throw bad('文本内容不能超过50万字符');}
  const mime=({pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',txt:'text/plain',md:'text/markdown'} as Record<string,string>)[extension];
  await writeFile(filename,buffer,{flag:'wx'});
  try{return await mutate(db,a,req.headers['if-match'],'上传知识文件',name,async tx=>{await tx.query('INSERT INTO knowledge(id,tenant_id,name,category,size,mime,status,text_content,file_key,sha256,audience) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[fileId,a.tenantId,name,category,buffer.length,mime,text===null?'pending':'ready',text,key,createHash('sha256').update(buffer).digest('hex'),JSON.stringify({mode:'members',memberIds:[],departments:[]})]);return mapKnowledge(await getKnowledge(tx,a.tenantId,fileId));});}catch(e){await unlink(filename).catch(()=>{});throw e;}
 });
 app.get(`${prefix}/knowledge/:id/download`,async(req,reply)=>{const a=requireTenant(req);requireContent(a);const k=await getKnowledge(db,a.tenantId,resourceId(req));const body=k.file_key?await readFile(join(config.dataDir,'files',k.file_key)):Buffer.from(k.text_content||'');reply.header('content-type','application/octet-stream').header('content-disposition',`attachment; filename*=UTF-8''${encodeURIComponent(k.name)}`).header('cache-control','no-store');return reply.send(body);});
 app.put(`${prefix}/knowledge/:id/audience`,async req=>{const a=requireTenant(req);requireContent(a);const audience=audienceSchema.parse(req.body),expectedAudience=audienceSchema.parse((req.body as any)?.expectedAudience);return mutate(db,a,req.headers['if-match'],'设置知识可见范围',resourceId(req),async tx=>{const current=await getKnowledge(tx,a.tenantId,resourceId(req));if(current.status==='archived')throw bad('请先恢复归档资料');if(!sameAudience(current.audience||enterpriseAudience(),expectedAudience))throw conflict('知识使用范围已被修改，请重新加载范围后核对');await validateAudience(tx,a.tenantId,audience);await tx.query('UPDATE knowledge SET audience=$1,updated_at=now() WHERE tenant_id=$2 AND id=$3',[JSON.stringify(audience),a.tenantId,resourceId(req)]);return mapKnowledge(await getKnowledge(tx,a.tenantId,resourceId(req)));});});
 for(const action of ['archive','restore'] as const)app.post(`${prefix}/knowledge/:id/${action}`,async req=>{const a=requireTenant(req);requireContent(a);return mutate(db,a,req.headers['if-match'],action==='archive'?'归档文件':'恢复文件',resourceId(req),async tx=>{const k=await getKnowledge(tx,a.tenantId,resourceId(req));if(action==='archive'&&(await tx.query("SELECT 1 FROM course_knowledge ck JOIN courses c ON c.id=ck.course_id AND c.tenant_id=ck.tenant_id WHERE ck.tenant_id=$1 AND ck.knowledge_id=$2 AND c.status<>'archived' LIMIT 1",[a.tenantId,k.id])).rows.length)throw conflict('文件已被课程引用，请先解除关联');await tx.query('UPDATE knowledge SET status=$1,updated_at=now() WHERE tenant_id=$2 AND id=$3',[action==='archive'?'archived':k.text_content!==null?'ready':'pending',a.tenantId,k.id]);return {ok:true};});});
 app.get(`${prefix}/questions`,async req=>{const a=requireTenant(req);requireContent(a);return {items:(await db.query('SELECT data FROM questions WHERE tenant_id=$1 ORDER BY id',[a.tenantId])).rows.map(r=>r.data)};});
 const saveQuestion=async(req:FastifyRequest,create:boolean)=>{const a=requireTenant(req);requireContent(a);const input=questionInput.parse(req.body);if(!unique(input.options.map(o=>o.id))||!unique(input.answers))throw bad('选项和答案不能重复');if(['single','multiple','boolean'].includes(input.type)){if(input.options.length<2||input.answers.some(answer=>!input.options.some(o=>o.id===answer)))throw bad('至少两个选项，标准答案必须属于题目选项');if(input.type!=='multiple'&&input.answers.length!==1)throw bad('单选或判断题只能有一个标准答案');}return mutate(db,a,req.headers['if-match'],'保存试题',input.title,async tx=>{const c=await getCourse(tx,a.tenantId,input.courseId);if(c.kind!=='exam'||c.status==='archived')throw bad('试题必须属于未归档考试课程');const questionId=create?(input.id||randomUUID()):resourceId(req);if(create)await tx.query('INSERT INTO questions(id,tenant_id,course_id,data) VALUES($1,$2,$3,$4)',[questionId,a.tenantId,c.id,JSON.stringify({...input,id:questionId})]);else{const prior=(await tx.query('SELECT course_id FROM questions WHERE tenant_id=$1 AND id=$2',[a.tenantId,questionId])).rows[0];if(!prior)throw missing();if(prior.course_id!==c.id)throw bad('不能改变试题所属课程');await tx.query('UPDATE questions SET data=$1 WHERE tenant_id=$2 AND id=$3',[JSON.stringify({...input,id:questionId}),a.tenantId,questionId]);}return {id:questionId};});};
 app.post(`${prefix}/questions`,req=>saveQuestion(req,true));app.put(`${prefix}/questions/:id`,req=>saveQuestion(req,false));
 app.get(`${prefix}/reports`,async req=>{const a=requireTenant(req);requireAdmin(a);const b=await bootstrap(db,a);return {courses:b.db.courses.length,publishedTasks:b.db.tasks.filter(t=>t.status==='published').length,assignedMembers:new Set(b.db.tasks.filter(t=>t.status==='published').flatMap(t=>t.memberIds)).size,completedAssignments:b.db.tasks.reduce((n,t)=>n+t.completedMemberIds.length,0),audit:b.db.audit};});
}
