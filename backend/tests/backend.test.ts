import {AdminTransport} from '../../admin/src/transport.ts';
import {normalizeElement} from '@openmaic/dsl';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { openDatabase, type Database } from '../src/db.ts';
import { initialize } from '../src/bootstrap.ts';
import { buildApp } from '../src/app.ts';
import type { Config } from '../src/config.ts';
import { signBridge } from '../src/integration.ts';
import { callModel, loadProvider } from '../src/ai-provider.ts';
import { extractMaterial } from '../src/material-parser.ts';
import JSZip from 'jszip';
import { olaTrainingAuthentication } from '../../OpenMAIC/lib/server/identity/host/ola-training.ts';
const password='Test-Only!Backend-2026';
let rootDir:string,db:Database,app:Awaited<ReturnType<typeof buildApp>>,config:Config;
type Client={cookie:string;csrf:string;tenant:string};let root:Client,adminB:Client,learner:Client,author:Client;let learnerId:string,courseId:string,taskId:string,fileId:string;
async function login(email:string,pass=password,remoteAddress='127.0.0.2'):Promise<Client>{const res=await app.inject({method:'POST',url:'/api/auth/login',payload:{email,password:pass},remoteAddress});assert.equal(res.statusCode,200,res.body);return {cookie:String(res.headers['set-cookie']).split(';')[0],csrf:res.json().csrf,tenant:'fujian'};}
async function request(c:Client,method:'GET'|'POST'|'PUT',url:string,payload?:unknown,extra:Record<string,string>={}){return app.inject({method,url,payload:payload as any,headers:{cookie:c.cookie,'x-csrf-token':c.csrf,...extra}});}
async function provision(email:string,role:string,tenant='fujian'){if(root.tenant!==tenant){const s=await request(root,'POST','/api/auth/switch-tenant',{tenantId:tenant});assert.equal(s.statusCode,200);root.tenant=tenant;}const department=tenant==='fujian'?'市场部':'产品部';const m=await request(root,'POST',`/api/tenants/${tenant}/members`,{name:email.split('@')[0],employeeNo:randomUUID(),department,role,active:true});assert.equal(m.statusCode,200,m.body);const memberId=m.json().id;const p=await request(root,'POST',`/api/tenants/${tenant}/members/${memberId}/account`,{email,password});assert.equal(p.statusCode,200,p.body);const c=await login(email);c.tenant=tenant;return {client:c,id:memberId};}
before(async()=>{rootDir=await mkdtemp(join(tmpdir(),'ola-api-test-'));config={production:false,host:'127.0.0.1',port:4190,origin:'http://127.0.0.1:4180',allowedOrigins:['http://100.64.0.6:4173','http://100.64.0.6:4180','http://100.64.0.6:4181'],dataDir:rootDir,adminEmail:'root@test.local',adminPassword:password,sessionHours:12,seedDemo:true};db=await openDatabase(undefined,join(rootDir,'postgres'));await initialize(db,config);app=await buildApp(db,config);root=await login(config.adminEmail);const l=await provision('learner@test.local','学员');learner=l.client;learnerId=l.id;author=(await provision('author@test.local','内容作者')).client;adminB=(await provision('tenant-b@test.local','企业管理员','haichuan')).client;await request(root,'POST','/api/auth/switch-tenant',{tenantId:'fujian'});root.tenant='fujian';});
after(async()=>{await app.close();await db.close();await rm(rootDir,{recursive:true,force:true});});

test('模型配置按企业隔离、密钥加密与保留、真实传输适配器及安全错误',async()=>{
 const endpoint='/api/tenants/fujian/ai/provider';
 assert.equal((await request(learner,'GET',endpoint)).statusCode,403);
 assert.equal((await request(author,'PUT',endpoint,{baseUrl:'https://example.com/v1',model:'model',apiKey:'secret'})).statusCode,403);
 assert.equal((await request(adminB,'GET',endpoint)).statusCode,403);
 assert.equal((await request(root,'GET',endpoint)).json().configured,false);
 assert.equal((await request(root,'PUT',endpoint,{baseUrl:'https://example.com/v1',model:'model'})).statusCode,400);
 assert.equal((await request(root,'PUT',endpoint,{baseUrl:'https://user:password@example.com/v1',model:'model',apiKey:'secret'})).statusCode,400);
 await assert.rejects(()=>callModel({...config,production:true},{baseUrl:'https://127.0.0.1/v1',model:'model',apiKey:'secret'},'test','test'),(e:any)=>e.status===400);
 let calls=0;const secret='only-test-secret-never-return';
 const server=createServer((req,res)=>{let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{calls++;assert.equal(req.headers.authorization,`Bearer ${secret}`);assert.equal(req.url,'/v1/chat/completions');assert.equal(JSON.parse(body).model,'test-model');res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:'OK'}}]}));});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const baseUrl=`http://127.0.0.1:${(server.address() as any).port}/v1`;
  const saved=await request(root,'PUT',endpoint,{baseUrl,model:'test-model',apiKey:secret});assert.equal(saved.statusCode,200,saved.body);
  const row=(await db.query('SELECT * FROM ai_provider_settings WHERE tenant_id=$1',['fujian'])).rows[0];assert(!row.encrypted_key.includes(secret));
  const publicConfig=await request(root,'GET',endpoint);assert.equal(publicConfig.json().hasKey,true);assert(!publicConfig.body.includes(secret));assert(!publicConfig.body.includes(row.encrypted_key));
  assert.equal((await loadProvider(db,config,'fujian')).apiKey,secret);
  assert.equal((await request(root,'PUT',endpoint,{baseUrl,model:'test-model'})).statusCode,200);
  assert.equal((await request(root,'PUT',endpoint,{baseUrl:baseUrl+'/changed',model:'test-model'})).statusCode,400);
  const tested=await request(root,'POST',endpoint+'/test',{});assert.equal(tested.statusCode,200,tested.body);assert.equal(tested.json().connected,true);assert.equal(calls,1);
  assert.equal((await request(adminB,'GET','/api/tenants/haichuan/ai/provider')).json().configured,false);
  await db.query('INSERT INTO ai_provider_settings(tenant_id,base_url,model,encrypted_key) VALUES($1,$2,$3,$4)',['haichuan',baseUrl,'test-model',row.encrypted_key]);
  await assert.rejects(()=>loadProvider(db,config,'haichuan'),(e:any)=>e.code==='AI_KEY_UNAVAILABLE');
  await db.query('UPDATE ai_provider_settings SET encrypted_key=$1 WHERE tenant_id=$2',[row.encrypted_key.slice(0,-3)+'zzz','fujian']);
  const broken=await request(root,'POST',endpoint+'/test',{});assert.equal(broken.statusCode,503);assert.equal(broken.json().error.code,'AI_KEY_UNAVAILABLE');assert(!broken.body.includes(secret));
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test('会话认证、CSRF和来源校验在服务端生效',async()=>{
 assert.equal((await app.inject({url:'/api/bootstrap'})).statusCode,401);
 assert.equal((await app.inject({method:'POST',url:'/api/auth/login',payload:{email:'root@test.local',password:'wrong'}})).statusCode,401);
 assert.equal((await app.inject({method:'POST',url:'/api/auth/switch-tenant',headers:{cookie:root.cookie},payload:{tenantId:'haichuan'}})).statusCode,403);
 assert.equal((await request(root,'POST','/api/auth/switch-tenant',{tenantId:'haichuan'},{origin:'https://other.invalid'})).statusCode,403);
 const me=await request(root,'GET','/api/auth/me');assert.equal(me.statusCode,200);assert.equal(me.json().tenants.length,2);
 assert.match(root.cookie,/ola_session=/);
});
test('企业上下文由会话和成员资格决定，不能通过URL或请求体越权',async()=>{
 assert.equal((await request(adminB,'GET','/api/tenants/fujian/courses')).statusCode,403);
 assert.equal((await request(adminB,'POST','/api/auth/switch-tenant',{tenantId:'fujian'})).statusCode,403);
 assert.equal((await request(adminB,'GET','/api/tenants/haichuan/courses/fujian-c0')).statusCode,404);
 const snapshot=await request(adminB,'GET','/api/bootstrap');assert(snapshot.json().db.courses.every((c:any)=>c.tenantId==='haichuan'));assert(snapshot.json().db.members.every((m:any)=>m.tenantId==='haichuan'));
 assert.equal((await request(learner,'GET','/api/bootstrap')).statusCode,403);
 assert.equal((await request(author,'POST','/api/tenants/fujian/tasks',{})).statusCode,403);
 assert.deepEqual((await request(author,'GET','/api/bootstrap')).json().db.members,[]);
});
test('创建课程、不可变完整发布版本以及跨企业知识关联校验',async()=>{
 const seed=(await request(root,'GET','/api/tenants/fujian/courses/fujian-c0')).json();
 const invalid=await request(root,'POST','/api/tenants/fujian/courses',{...seed,id:randomUUID(),knowledgeIds:['haichuan-k1'],publish:true});assert.equal(invalid.statusCode,400);
 const created=await request(root,'POST','/api/tenants/fujian/courses',{...seed,id:randomUUID(),tenantId:'haichuan',title:'数据库课程',lessons:[{id:'unit1',title:'开场',format:'文档',content:'原始课程正文'}],publish:true});assert.equal(created.statusCode,200,created.body);courseId=created.json().id;assert.equal(created.json().tenantId,'fujian');assert.equal(created.json().version,1);
 const v=(await request(root,'GET',`/api/tenants/fujian/courses/${courseId}/versions`)).json();assert.equal(v.items[0].content.lessons[0].content,'原始课程正文');
});
test('任务发布快照、企业关联、顺序解锁、幂等学习进度和完成汇总',async()=>{
 const today=new Date().toISOString().slice(0,10);const due=new Date(Date.now()+86400000*10).toISOString().slice(0,10);
 const cross=await request(root,'POST','/api/tenants/fujian/tasks',{title:'越权任务',description:'',start:today,due,sequential:false,courseIds:['haichuan-c0'],memberIds:[learnerId],publish:true});assert.equal(cross.statusCode,400);
 const t=await request(root,'POST','/api/tenants/fujian/tasks',{title:'数据库任务',description:'学考顺序',start:today,due,sequential:true,courseIds:[courseId,'fujian-c3'],memberIds:[learnerId],publish:true});assert.equal(t.statusCode,200,t.body);taskId=t.json().id;
 assert.equal((await request(root,'POST',`/api/tenants/fujian/courses/${courseId}/archive`)).statusCode,409);
 const v1=(await request(root,'GET',`/api/tenants/fujian/courses/${courseId}`)).json();const edited=await request(root,'PUT',`/api/tenants/fujian/courses/${courseId}`,{...v1,title:'课程修订',lessons:[{id:'unit1',title:'新版',format:'文档',content:'新正文'}],publish:false});assert.equal(edited.statusCode,200);assert.equal(edited.json().version,2);
 const tasks=(await request(root,'GET','/api/tenants/fujian/tasks')).json().items;const saved=tasks.find((x:any)=>x.id===taskId);assert.equal(saved.snapshot[0].title,'数据库课程');assert.equal(saved.snapshot[0].version,1);
 const old=(await request(learner,'GET',`/api/learn/courses/${courseId}/versions/1`)).json();assert.equal(old.lessons[0].content,'原始课程正文');
 assert.equal((await request(learner,'POST','/api/learn/exams/fujian-c3/attempts',{version:1})).statusCode,403);
 const event={courseId,version:1,lessonId:'unit1',eventId:randomUUID()};assert.equal((await request(learner,'POST','/api/learn/progress',event)).statusCode,200);assert.equal((await request(learner,'POST','/api/learn/progress',event)).statusCode,200);
 assert.equal((await db.query('SELECT count(*)::int AS count FROM learning_progress WHERE tenant_id=$1 AND member_id=$2 AND course_id=$3',['fujian',learnerId,courseId])).rows[0].count,1);
});
test('考试题目不泄露答案，服务端评分与提交幂等、过期作答限制',async()=>{
 const attempt=await request(learner,'POST','/api/learn/exams/fujian-c3/attempts',{version:1});assert.equal(attempt.statusCode,200,attempt.body);const value=attempt.json();assert(value.paper.questions.every((q:any)=>!('answers'in q)&&!('explanation'in q)));
 const duplicate=await request(learner,'POST','/api/learn/exams/fujian-c3/attempts',{version:1});assert.equal(duplicate.json().id,value.id);
 const answers={'fujian-c3-q1':['A'],'fujian-c3-q2':['A','B'],'fujian-c3-q3':['预算']};const graded=await request(learner,'POST',`/api/learn/attempts/${value.id}/submit`,{answers,revision:0,score:999});assert.equal(graded.statusCode,200,graded.body);assert.equal(graded.json().score,100);assert.equal(graded.json().passed,true);
 assert.equal((await request(learner,'POST',`/api/learn/attempts/${value.id}/submit`,{answers:{}})).json().score,100);
 const own=(await request(learner,'GET','/api/learn/tasks')).json().items.find((t:any)=>t.id===taskId);assert.deepEqual(own.completedMemberIds,[learnerId]);
 const report=await request(root,'GET',`/api/tenants/fujian/reports/tasks/${taskId}`);assert.equal(report.statusCode,200,report.body);assert.equal(report.json().completed,1);assert.equal(report.json().items[0].completedCourses,2);assert.equal(report.json().items[0].stages[0].version,1);assert.equal(report.json().items[0].stages[1].score,100);assert.equal(report.json().items[0].stages[0].completedLessons,1);
 assert.equal((await request(learner,'GET',`/api/tenants/fujian/reports/tasks/${taskId}`)).statusCode,403);
 assert.equal((await request(adminB,'GET',`/api/tenants/haichuan/reports/tasks/${taskId}`)).statusCode,404);
 assert.equal((await request(adminB,'GET',`/api/learn/attempts/${value.id}`)).statusCode,404);
 const second=(await request(learner,'POST','/api/learn/exams/fujian-c3/attempts',{version:1})).json();await db.query("UPDATE exam_attempts SET expires_at=now()-interval '1 minute' WHERE id=$1",[second.id]);assert.equal((await request(learner,'PUT',`/api/learn/attempts/${second.id}/answers`,{answers,revision:0})).statusCode,409);const expired=await request(learner,'POST',`/api/learn/attempts/${second.id}/submit`,{answers});assert.equal(expired.json().score,0);
});
test('训练过程真实保存，结束待评价而非伪造AI得分',async()=>{
 const created=await request(learner,'POST','/api/learn/training',{courseId:'fujian-c2',version:1});assert.equal(created.statusCode,200,created.body);const sessionId=created.json().id;const message={id:randomUUID(),text:'请问您的使用场景和预算是多少？'};
 assert.equal((await request(learner,'POST',`/api/learn/training/${sessionId}/messages`,message)).json().aiReply,null);
 assert.equal((await request(learner,'POST',`/api/learn/training/${sessionId}/messages`,message)).statusCode,200);
 assert.equal((await request(learner,'POST',`/api/learn/training/${sessionId}/finish`)).json().status,'pending_review');
 assert.equal((await request(learner,'POST',`/api/tenants/fujian/training/${sessionId}/review`,{score:80,feedback:'评价',passed:true})).statusCode,403);
 assert.equal((await request(root,'POST',`/api/tenants/fujian/training/${sessionId}/review`,{score:80,feedback:'能准确确认客户需求。',passed:true})).statusCode,200);
 const history=(await request(learner,'GET',`/api/learn/training/${sessionId}`)).json();assert.equal(history.messages.length,1);assert.equal(history.session.score,80);
 const reviews=await request(root,'GET','/api/tenants/fujian/training?status=completed');assert.equal(reviews.statusCode,200,reviews.body);assert(reviews.json().items.some((r:any)=>r.id===sessionId));
 const detail=(await request(root,'GET',`/api/tenants/fujian/training/${sessionId}`)).json();assert.equal(detail.messages.length,1);assert.equal(detail.record.course_content.id,'fujian-c2');assert.equal(detail.record.course_content.version,1);assert.equal(detail.record.member_name,'learner');
 assert.equal((await request(learner,'GET',`/api/tenants/fujian/training/${sessionId}`)).statusCode,403);
 assert.equal((await request(adminB,'GET',`/api/tenants/haichuan/training/${sessionId}`)).statusCode,404);
 assert.equal((await request(learner,'GET','/api/tenants/fujian/exam-attempts')).statusCode,403);
 const papers=await request(root,'GET','/api/tenants/fujian/exam-attempts?status=graded&limit=10');assert.equal(papers.statusCode,200,papers.body);assert(papers.json().items.length>=2);
 assert.equal((await request(adminB,'GET',`/api/learn/training/${sessionId}`)).statusCode,404);
});
test('训练结束原子保存未发送表达，响应重试不重复、失败不改变状态',async()=>{
 const created=await request(learner,'POST','/api/learn/training',{courseId:'fujian-c2',version:1});assert.equal(created.statusCode,200,created.body);const sid=created.json().id,path=`/api/learn/training/${sid}`;
 const prior={id:randomUUID(),text:'已保存表达'};assert.equal((await request(learner,'POST',path+'/messages',prior)).statusCode,200);
 assert.equal((await request(learner,'POST',path+'/finish',{draft:{...prior,text:'不可替换旧表达'}})).statusCode,409);assert.equal((await request(learner,'GET',path)).json().session.status,'active');
 const draft={id:randomUUID(),text:'输入框中尚未单独保存的表达'};
 const finished=await request(learner,'POST',path+'/finish',{draft});assert.equal(finished.statusCode,200,finished.body);assert.equal(finished.json().status,'pending_review');
 assert.equal((await request(learner,'POST',path+'/finish',{draft})).statusCode,200);let detail=(await request(learner,'GET',path)).json();assert.equal(detail.messages.length,2);assert.equal(detail.messages.filter((row:any)=>row.id===draft.id).length,1);assert.equal(detail.messages.find((row:any)=>row.id===draft.id).text,draft.text);
 assert.equal((await request(learner,'POST',path+'/finish',{draft:{...draft,text:'变化'}})).statusCode,409);assert.equal((await request(learner,'POST',path+'/finish',{draft:{...draft,id:randomUUID()}})).statusCode,409);
 assert.equal((await request(adminB,'POST',path+'/finish',{draft})).statusCode,404);
 assert.equal((await request(root,'POST',`/api/tenants/fujian/training/${sid}/review`,{score:89,feedback:'原子结束验收',passed:true})).statusCode,200);
 assert.equal((await request(learner,'POST',path+'/finish',{draft})).json().status,'completed');detail=(await request(learner,'GET',path)).json();assert.equal(detail.session.score,89);assert.equal(detail.messages.length,2);
 const original=(await request(root,'GET','/api/tenants/fujian/courses/fujian-c2')).json();assert.equal(detail.course.version,1);assert.equal(detail.course.title,original.title);
 const ongoing=(await request(learner,'POST','/api/learn/training',{courseId:'fujian-c2',version:1})).json();assert.ok(ongoing.id);
 const changed=await request(root,'PUT','/api/tenants/fujian/courses/fujian-c2',{...original,title:'训练新版名称',publish:true});assert.equal(changed.statusCode,200,changed.body);assert.equal(changed.json().version,2);
 const historical=(await request(learner,'GET',path)).json();assert.equal(historical.course.title,original.title);assert.equal(historical.course.version,1);assert.equal(historical.session.score,89);
 assert.equal((await request(learner,'GET','/api/learn/courses/fujian-c2/versions/1')).statusCode,404);
 assert.equal((await request(learner,'POST',`/api/learn/training/${ongoing.id}/messages`,{id:randomUUID(),text:'新版发布后继续原训练'})).statusCode,200);
 assert.equal((await request(learner,'POST',`/api/learn/training/${ongoing.id}/finish`,{draft:{id:randomUUID(),text:'原版本结束表达'}})).statusCode,200);
 const scoped=await request(root,'PUT','/api/tenants/fujian/courses/fujian-c2',{...(changed.json() as any),audience:{mode:'members',memberIds:[(await db.query("SELECT id FROM members WHERE tenant_id='fujian' AND employee_no='ADMIN'")).rows[0].id],departments:[]},publish:true});assert.equal(scoped.statusCode,200,scoped.body);assert.equal((await request(learner,'GET',path)).statusCode,404);
 const restored=await request(root,'PUT','/api/tenants/fujian/courses/fujian-c2',{...(scoped.json() as any),audience:original.audience||{mode:'enterprise',memberIds:[],departments:[]},publish:true});assert.equal(restored.statusCode,200,restored.body);


});

test('文件上传、原文下载与服务端企业隔离',async()=>{
 const boundary='ola-'+randomUUID();const text='# 测试知识\n服务正文';const multipart=Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="category"\r\n\r\n服务规范\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.md"\r\nContent-Type: text/markdown\r\n\r\n${text}\r\n--${boundary}--\r\n`);
 const uploaded=await request(root,'POST','/api/tenants/fujian/knowledge',multipart,{'content-type':`multipart/form-data; boundary=${boundary}`});assert.equal(uploaded.statusCode,200,uploaded.body);fileId=uploaded.json().id;assert.equal(uploaded.json().text,text);
 const downloaded=await request(root,'GET',`/api/tenants/fujian/knowledge/${fileId}/download`);assert.equal(downloaded.body,text);assert.match(String(downloaded.headers['content-disposition']),/attachment/);
 assert.equal((await request(adminB,'GET',`/api/tenants/haichuan/knowledge/${fileId}/download`)).statusCode,404);
 const r=(await db.query('SELECT file_key FROM knowledge WHERE id=$1',[fileId])).rows[0];assert.equal((await readFile(join(rootDir,'files',r.file_key),'utf8')),text);
});
test('知识范围可配置且即时生效，陈旧范围写入、越权和跨企业成员被拒绝',async()=>{
 const boundary='scope-'+randomUUID(),content='范围编辑联调原文';const upload=await request(root,'POST','/api/tenants/fujian/knowledge',Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="scope-test.md"\r\nContent-Type: text/markdown\r\n\r\n${content}\r\n--${boundary}--\r\n`),{'content-type':`multipart/form-data; boundary=${boundary}`});assert.equal(upload.statusCode,200,upload.body);const record=upload.json(),url=`/api/tenants/fujian/knowledge/${record.id}/audience`,privateScope=record.audience,enterprise={mode:'enterprise',departments:[],memberIds:[]};
 assert.equal((await request(learner,'GET',`/api/learn/knowledge/${record.id}/download`)).statusCode,404);
 assert.equal((await request(learner,'PUT',url,{...enterprise,expectedAudience:privateScope})).statusCode,403);
 assert.equal((await request(root,'PUT',url,enterprise)).statusCode,400);
 const updated=await request(root,'PUT',url,{...enterprise,expectedAudience:privateScope});assert.equal(updated.statusCode,200,updated.body);const head=await app.inject({method:'HEAD',url:`/api/learn/knowledge/${record.id}/download`,headers:{cookie:learner.cookie}});assert.equal(head.statusCode,200,head.body);assert(head.headers['content-disposition']?.includes('scope-test.md'));assert.equal(head.body,'');assert.equal((await request(learner,'GET',`/api/learn/knowledge/${record.id}/download`)).body,content);
 const chat=(await request(learner,'POST','/api/learn/assistant/sessions',{app:'terminal',title:'范围原文检索'})).json();const answer=await request(learner,'POST',`/api/learn/assistant/sessions/${chat.id}/messages`,{id:randomUUID(),text:content});assert.equal(answer.statusCode,200,answer.body);assert.equal(answer.json().sources[0].id,record.id);
 const stale=await request(root,'PUT',url,{...privateScope,expectedAudience:privateScope});assert.equal(stale.statusCode,409,stale.body);
 assert.equal((await request(root,'PUT',url,{mode:'members',memberIds:['haichuan-m1'],departments:[],expectedAudience:enterprise})).statusCode,400);
 assert.equal((await request(adminB,'PUT',`/api/tenants/haichuan/knowledge/${record.id}/audience`,{...enterprise,expectedAudience:privateScope})).statusCode,404);
 const restricted={mode:'members',memberIds:[learnerId],departments:[]};assert.equal((await request(author,'PUT',url,{...restricted,expectedAudience:enterprise})).statusCode,200);
 assert.equal((await request(learner,'GET',`/api/learn/knowledge/${record.id}/download`)).statusCode,200);assert.equal((await request(author,'GET',`/api/learn/knowledge/${record.id}/download`)).statusCode,404);
 assert.equal((await request(root,'PUT',url,{...privateScope,expectedAudience:restricted})).statusCode,200);assert.equal((await request(learner,'GET',`/api/learn/knowledge/${record.id}/download`)).statusCode,404);
 const history=await request(learner,'GET',`/api/learn/assistant/sessions/${chat.id}`);assert.equal(history.statusCode,200,history.body);assert(!history.json().messages[0].result.sources.some((source:any)=>source.id===record.id));
});

test('PC学员会话独立，收藏评价和知识会话真实保存且按成员隔离',async()=>{
 const loginResult=await app.inject({method:'POST',url:'/api/auth/login',payload:{email:'learner@test.local',password},headers:{'x-ola-client':'learner'}});assert.equal(loginResult.statusCode,200);assert.match(String(loginResult.headers['set-cookie']),/ola_learner_session=/);
 const learnerCookie=String(loginResult.headers['set-cookie']).split(';')[0];const both=root.cookie+'; '+learnerCookie;
 assert.equal((await app.inject({url:'/api/auth/me',headers:{cookie:both,'x-ola-client':'learner'}})).json().user.memberId,learnerId);
 assert.notEqual((await app.inject({url:'/api/auth/me',headers:{cookie:both}})).json().user.memberId,learnerId);
 assert.equal((await app.inject({url:'/api/auth/me',headers:{cookie:root.cookie,'x-ola-client':'learner'}})).statusCode,401);
 assert.equal((await request(learner,'PUT','/api/learn/favorites/fujian-c0',{favorite:true})).statusCode,200);
 assert.equal((await request(learner,'PUT','/api/learn/favorites/haichuan-c0',{favorite:true})).statusCode,404);
 assert.equal((await request(learner,'PUT',`/api/learn/courses/${courseId}/review`,{version:1,rating:5,comment:'课程内容实用'})).statusCode,200);
 assert.equal((await request(learner,'PUT','/api/learn/courses/fujian-c0/review',{version:1,rating:5,comment:''})).statusCode,409);
 const chat=await request(learner,'POST','/api/learn/assistant/sessions',{app:'service',title:'查询客户服务'});assert.equal(chat.statusCode,200);const chatId=chat.json().id,messageId=randomUUID();
 const result=await request(learner,'POST',`/api/learn/assistant/sessions/${chatId}/messages`,{id:messageId,text:'客户服务'});assert.equal(result.statusCode,200,result.body);assert.equal(result.json().mode,'retrieval');assert(result.json().sources.some((s:any)=>s.type==='knowledge'));
 assert.equal((await request(learner,'POST',`/api/learn/assistant/sessions/${chatId}/messages`,{id:messageId,text:'客户服务'})).statusCode,200);
 assert.equal((await request(root,'GET',`/api/learn/assistant/sessions/${chatId}`)).statusCode,404);
 assert.equal((await request(adminB,'GET',`/api/learn/assistant/sessions/${chatId}`)).statusCode,404);
 const history=await request(learner,'GET',`/api/learn/assistant/sessions/${chatId}`);assert.equal(history.json().messages.length,1);
 const before=(await request(learner,'GET','/api/learn/overview')).json();assert(before.favorites.includes('fujian-c0'));assert(before.reviews.some((r:any)=>r.comment==='课程内容实用'));assert(before.completed.includes(courseId+':1'));assert(before.courses.every((c:any)=>c.tenantId==='fujian'&&!c.questions));assert(before.tasks.every((t:any)=>t.memberIds.length===1&&t.memberIds[0]===learnerId));
 assert.equal((await request(learner,'POST','/api/learn/notifications/read',{ids:before.notifications.map((n:any)=>n.id)})).statusCode,200);assert((await request(learner,'GET','/api/learn/overview')).json().notifications.every((n:any)=>n.read));
 const ranking=(await request(learner,'GET','/api/learn/leaderboard')).json().items;assert(ranking.some((r:any)=>r.isMe));assert(!ranking.some((r:any)=>r.name==='tenant-b'));
});
test('并发修订冲突、真实审计与成员账号安全约束',async()=>{
 const snapshot=(await request(root,'GET','/api/bootstrap')).json();const revision=snapshot.revision;const member=snapshot.db.members.find((m:any)=>m.id===learnerId);
 assert.equal((await request(root,'PUT',`/api/tenants/fujian/members/${learnerId}`,{...member,name:'已修改学员'},{'if-match':String(revision)})).statusCode,200);
 assert.equal((await request(root,'PUT',`/api/tenants/fujian/members/${learnerId}`,member,{'if-match':String(revision)})).statusCode,409);
 const admin=snapshot.db.members.find((m:any)=>m.employeeNo==='ADMIN');assert.equal((await request(root,'PUT',`/api/tenants/fujian/members/${admin.id}`,{...admin,active:false})).statusCode,409);
 const changed=await request(learner,'POST','/api/auth/password',{currentPassword:password,password:'Changed!Only-Backend2026'});assert.equal(changed.statusCode,200);assert.equal((await request(learner,'GET','/api/learn/progress')).statusCode,401);
 learner=await login('learner@test.local','Changed!Only-Backend2026');assert.equal((await request(root,'PUT',`/api/tenants/fujian/members/${learnerId}`,{...member,active:false})).statusCode,200);assert.equal((await request(learner,'GET','/api/learn/progress')).statusCode,401);
 const audit=(await request(root,'GET','/api/tenants/fujian/reports')).json().audit;assert(audit.some((x:any)=>x.action==='发布课程'));assert(audit.every((x:any)=>x.tenantId==='fujian'));
});
test('OpenMAIC桥接签名校验方法/路径/过期/重放',async()=>{
 const secret='test-bridge-secret-32-characters-minimum';const method=olaTrainingAuthentication(secret);const path='/api/generation-runs?active=1';const token=signBridge(secret,'fujian',path,'GET');const req={headers:new Headers({'x-ola-bridge':token}),method:'GET',url:'http://127.0.0.1:3000'+path};
 assert.equal((await method.authenticate({...req,method:'POST'})).status,'invalid');assert.equal((await method.authenticate(req)).status,'authenticated');assert.equal((await method.authenticate(req)).status,'invalid');assert.equal((await method.authenticate({...req,headers:new Headers({'x-ola-bridge':token+'x'})})).status,'invalid');
});
test('真实HTTP上游适配：启动幂等、状态同步和企业归属拒绝',async()=>{
 let starts=0;const secret='test-bridge-secret-32-characters-minimum';const auth=olaTrainingAuthentication(secret);const upstream=createServer(async(req,res)=>{const outcome=await auth.authenticate({method:req.method,url:'http://localhost'+req.url,headers:new Headers({'x-ola-bridge':String(req.headers['x-ola-bridge']||'')})});if(outcome.status!=='authenticated'){res.writeHead(401).end('{}');return;}if(req.method==='POST')starts++;res.setHeader('content-type','application/json');res.end(JSON.stringify({data:{run:{id:'upstream-run',state:'completed',stageId:'stage-demo'}}}));});await new Promise<void>(resolve=>upstream.listen(0,'127.0.0.1',resolve));const address=upstream.address() as {port:number};const integrated=await buildApp(db,{...config,openmaicUrl:`http://127.0.0.1:${address.port}`,bridgeSecret:secret});
 try{const key=randomUUID();const call=()=>integrated.inject({method:'POST',url:'/api/tenants/fujian/integrations/openmaic/jobs',headers:{cookie:root.cookie,'x-csrf-token':root.csrf,'idempotency-key':key},payload:{courseId,requirement:'测试服务课程'}});const started=await call();assert.equal(started.statusCode,200,started.body);assert.equal((await call()).statusCode,200);assert.equal(starts,1);const jobId=started.json().id;const status=await integrated.inject({url:`/api/tenants/fujian/integrations/openmaic/jobs/${jobId}`,headers:{cookie:root.cookie}});assert.equal(status.statusCode,200);assert.equal(status.json().job.stageId,'stage-demo');assert.equal((await integrated.inject({url:`/api/tenants/haichuan/integrations/openmaic/jobs/${jobId}`,headers:{cookie:adminB.cookie}})).statusCode,404);}finally{await integrated.close();await new Promise<void>(resolve=>upstream.close(()=>resolve()));}
});
test('题库修订不改变已发布试卷，拒绝重复选项与跨企业改题',async()=>{
 const question=(await request(root,'GET','/api/tenants/fujian/questions')).json().items.find((q:any)=>q.id==='fujian-c3-q1');
 assert.equal((await request(root,'PUT',`/api/tenants/fujian/questions/${question.id}`,{...question,answers:['B']})).statusCode,200);
 const frozen=(await request(root,'GET','/api/tenants/fujian/courses/fujian-c3/versions')).json().items[0].content.questions.find((q:any)=>q.id===question.id);assert.deepEqual(frozen.answers,['A']);
 assert.equal((await request(adminB,'PUT',`/api/tenants/haichuan/questions/${question.id}`,{...question,courseId:'haichuan-c0'})).statusCode,400);
 assert.equal((await request(root,'POST','/api/tenants/fujian/questions',{...question,id:randomUUID(),options:[question.options[0],question.options[0]]})).statusCode,400);
});
test('DOCX/PPTX正文解析保留页序，拒绝空内容、实体和损坏文件',async()=>{
 const docx=new JSZip();docx.file('word/document.xml','<w:document xmlns:w="urn:word"><w:body><w:p><w:r><w:t>服务标准</w:t></w:r></w:p></w:body></w:document>');
 assert.deepEqual(await extractMaterial('test.docx',await docx.generateAsync({type:'nodebuffer'})),[{page:1,text:'服务标准'}]);
 const pptx=new JSZip();for(const page of [10,2,1])pptx.file(`ppt/slides/slide${page}.xml`,`<p:sld xmlns:p="urn:p" xmlns:a="urn:a"><a:p><a:r><a:t>第${page}张</a:t></a:r></a:p></p:sld>`);
 assert.deepEqual((await extractMaterial('test.pptx',await pptx.generateAsync({type:'nodebuffer'}))).map(u=>u.text),['第1张','第2张','第10张']);
 await assert.rejects(()=>extractMaterial('empty.txt',Buffer.from('   ')),/未提取/);
 const entity=new JSZip();entity.file('word/document.xml','<!DOCTYPE foo [<!ENTITY x SYSTEM "file:///secret">]><p>&x;</p>');const entityBuffer=await entity.generateAsync({type:'nodebuffer'});await assert.rejects(()=>extractMaterial('bad.docx',entityBuffer),/外部实体/);
 await assert.rejects(()=>extractMaterial('broken.docx',Buffer.from('PKbroken')));
});

test('PDF文本提取在Node环境可用，无需Canvas渲染',async()=>{
 const stream='BT /F1 12 Tf 72 720 Td (Hello PDF) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];for(const [index,body] of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${body}\nendobj\n`;}
 const start=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(v=>String(v).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
 const result=await extractMaterial('test.pdf',Buffer.from(pdf));assert.equal(result[0].page,1);assert.match(result[0].text,/Hello PDF/);
});

test('知识解析接口保存正文、页数与失败原因，并拒绝越权',async()=>{
 const docx=new JSZip();docx.file('word/document.xml','<w:document xmlns:w="urn:w"><w:p><w:r><w:t>真实文件解析接口测试</w:t></w:r></w:p></w:document>');
 const upload=async(buffer:Buffer,name:string)=>{const boundary='parse-'+randomUUID();return request(root,'POST','/api/tenants/fujian/knowledge',Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`),buffer,Buffer.from(`\r\n--${boundary}--\r\n`)]),{'content-type':`multipart/form-data; boundary=${boundary}`});};
 const uploaded=await upload(await docx.generateAsync({type:'nodebuffer'}),'parser.docx');assert.equal(uploaded.statusCode,200,uploaded.body);assert.equal(uploaded.json().status,'pending');const kid=uploaded.json().id;
 assert.equal((await request(adminB,'POST',`/api/tenants/haichuan/knowledge/${kid}/parse`,{})).statusCode,404);
 const parsed=await request(root,'POST',`/api/tenants/fujian/knowledge/${kid}/parse`,{});assert.equal(parsed.statusCode,200,parsed.body);assert.equal(parsed.json().status,'ready');assert.equal(parsed.json().pageCount,1);assert.match(parsed.json().text,/真实文件解析接口测试/);
 await db.query("UPDATE knowledge SET parse_token=$1,parse_started_at=now()-interval '4 minutes' WHERE tenant_id=$2 AND id=$3",[randomUUID(),'fujian',kid]);const interrupted=(await request(root,'GET','/api/tenants/fujian/knowledge')).json().items.find((item:any)=>item.id===kid);assert.equal(interrupted.parsing,false);assert.match(interrupted.parseError,/重新解析/);const recovered=await request(root,'POST',`/api/tenants/fujian/knowledge/${kid}/parse`,{});assert.equal(recovered.statusCode,200,recovered.body);assert.equal(recovered.json().parseError,undefined);assert.equal(recovered.json().pageCount,1);
 const broken=await upload(Buffer.from('PKbroken'),'broken.docx');assert.equal(broken.statusCode,200,broken.body);assert.equal((await request(root,'POST',`/api/tenants/fujian/knowledge/${broken.json().id}/parse`,{})).statusCode,400);
 const entry=(await request(root,'GET','/api/tenants/fujian/knowledge')).json().items.find((k:any)=>k.id===broken.json().id);assert(entry.parseError);assert.equal(entry.parsing,false);assert.equal(entry.status,'pending');
});

test('本地OpenMAIC制课：资料快照、大纲编辑、暂停重试、场景与动作保存、应用及发布版本',async()=>{
 const maicProvision=await provision('maic-learner@test.local','学员'),maicLearner=maicProvision.client;
 let calls=0;const bodies:any[]=[];let failContent=true;
 const server=createServer((req,res)=>{let raw='';req.on('data',chunk=>raw+=chunk);req.on('end',()=>{
  calls++;const body=JSON.parse(raw);bodies.push(body);res.setHeader('content-type','application/json');
  if(calls===2&&failContent){res.statusCode=500;res.end('{"error":"test-only model failure"}');return;}
  if(calls===4){res.end(JSON.stringify({choices:[{message:{content:'这不是有效的讲解动作数组'}}]}));return;}
  const content=calls===1?{courseTitle:'测试服务课堂',languageDirective:'请用中文讲授',outlines:[{id:'scene-one',type:'slide',title:'需求识别',description:'依据服务正文讲授',keyPoints:['先确认需求'],order:1}]}:calls===3?{elements:[{type:'text',id:'text-one',left:80,top:60,width:840,height:100,content:'<p>服务正文：先确认需求</p>'}],background:{type:'solid',color:'#ffffff'}}:[{type:'text',content:'先确认客户的需求，再给出建议。'}];
  res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(content)}}]}));
 });});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const configured=await request(root,'PUT','/api/tenants/fujian/ai/provider',{baseUrl:`http://127.0.0.1:${(server.address() as any).port}/v1`,model:'test-fixture-model',apiKey:'test-only-secret'});assert.equal(configured.statusCode,200,configured.body);
  const seed=(await request(root,'GET','/api/tenants/fujian/courses/fujian-c0')).json();
  const created=await request(root,'POST','/api/tenants/fujian/courses',{...seed,id:randomUUID(),title:'AI制课测试草稿',publish:false,knowledgeIds:[fileId]});assert.equal(created.statusCode,200,created.body);const cid=created.json().id;
  const start={courseId:cid,requirement:'根据所选资料设计一个服务培训课堂',knowledgeIds:[fileId]};const key=randomUUID(),path='/api/tenants/fujian/authoring/jobs';
  const first=await request(root,'POST',path,start,{'idempotency-key':key});assert.equal(first.statusCode,200,first.body);const jid=first.json().id;
  assert.equal((await request(root,'POST',path,start,{'idempotency-key':key})).json().id,jid);
  assert.equal((await request(root,'POST',path,{...start,requirement:'不同内容'},{'idempotency-key':key})).statusCode,409);
  assert.equal((await request(maicLearner,'GET',`${path}/${jid}`)).statusCode,403);
  assert.equal((await request(adminB,'GET',`/api/tenants/haichuan/authoring/jobs/${jid}`)).statusCode,404);
  const waitState=async(state:string)=>{for(let i=0;i<100;i++){const job=(await request(root,'GET',`${path}/${jid}`)).json();if(job.state===state)return job;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error(`job did not reach ${state}`);};
  let job=await waitState('awaiting_outline');assert.equal(calls,1);assert(bodies[0].messages.some((m:any)=>m.content.includes('服务正文')));
  const edited=await request(root,'PUT',`${path}/${jid}/outline`,{revision:job.revision,outlines:job.outline.map((o:any)=>({...o,title:'管理员修订标题'}))});assert.equal(edited.statusCode,200,edited.body);job=edited.json();
  assert.equal((await request(root,'PUT',`${path}/${jid}/outline`,{revision:1,outlines:job.outline})).statusCode,409);
  const command={commandId:randomUUID(),revision:job.revision,action:'confirm'};
  assert.equal((await request(root,'POST',`${path}/${jid}/commands`,command)).statusCode,200);assert.equal((await request(root,'POST',`${path}/${jid}/commands`,command)).statusCode,200);
  job=await waitState('paused');assert.equal(calls,2);failContent=false;
  assert.equal((await request(root,'POST',`${path}/${jid}/commands`,{commandId:randomUUID(),revision:job.revision,action:'retry'})).statusCode,200);
  job=await waitState('paused');assert.equal(calls,4);assert.equal(job.completedScenes,0);assert.match(job.error,/未返回有效讲解动作/);
  const retained=(await db.query('SELECT checkpoint FROM authoring_jobs WHERE id=$1',[jid])).rows[0].checkpoint;
  assert.equal(retained.pendingContent.outlineId,'scene-one');assert.match(retained.pendingContent.content.elements[0].content,/服务正文：先确认需求/);
  assert.equal((await request(root,'POST',`${path}/${jid}/commands`,{commandId:randomUUID(),revision:job.revision,action:'apply',courseUpdatedAt:'unused'})).statusCode,409);
  assert.equal((await request(root,'POST',`${path}/${jid}/commands`,{commandId:randomUUID(),revision:job.revision,action:'retry'})).statusCode,200);
  job=await waitState('ready');assert.equal(job.completedScenes,1);assert.equal(calls,5);assert.equal(job.scenes[0].title,'管理员修订标题');assert.equal(job.scenes[0].actions[0].type,'speech');assert.equal(job.scenes[0].actions[0].text,'先确认客户的需求，再给出建议。');assert(bodies[2].messages.some((m:any)=>m.content.includes('服务正文')));
  assert.equal((await request(root,'POST',`${path}/${jid}/commands`,{commandId:randomUUID(),revision:job.revision,action:'apply',courseUpdatedAt:'stale'})).statusCode,409);
  const course=(await request(root,'GET',`/api/tenants/fujian/courses/${cid}`)).json();
  assert.equal((await request(root,'POST',`${path}/${jid}/commands`,{commandId:randomUUID(),revision:job.revision,action:'apply',courseUpdatedAt:course.updatedAt})).statusCode,200);
  const applied=(await request(root,'GET',`/api/tenants/fujian/courses/${cid}`)).json();assert.equal(applied.lessons[0].format,'AI课堂');assert.equal(applied.classroom.scenes[0].id,'scene-one');
  const published=await request(root,'PUT',`/api/tenants/fujian/courses/${cid}`,{...applied,publish:true});assert.equal(published.statusCode,200,published.body);
  const frozen=(await request(root,'GET',`/api/tenants/fujian/courses/${cid}/versions`)).json().items[0].content;assert.equal(frozen.classroom.scenes[0].title,'管理员修订标题');
  const runtimePath=`/api/learn/courses/${cid}/versions/1/classroom/scenes/scene-one/runtime`;
  assert.equal((await request(maicLearner,'GET',runtimePath)).json().revision,0);
  const runtimeEvent={eventId:randomUUID(),revision:0,state:{actionIndex:0,answers:{},submitted:false,notes:{reflection:'跨设备保存的学习反思'}}};
  const savedRuntime=await request(maicLearner,'PUT',runtimePath,runtimeEvent);assert.equal(savedRuntime.statusCode,200,savedRuntime.body);assert.equal(savedRuntime.json().revision,1);
  assert.equal((await request(maicLearner,'PUT',runtimePath,runtimeEvent)).json().revision,1);
  assert.equal((await request(maicLearner,'PUT',runtimePath,{...runtimeEvent,eventId:randomUUID()})).statusCode,409);
  assert.equal((await request(maicLearner,'PUT',runtimePath,{...runtimeEvent,state:{...runtimeEvent.state,notes:{reflection:'同一事件不可换内容'}}})).statusCode,409);
  assert.equal((await request(root,'GET',runtimePath)).json().revision,0);
  assert.equal((await request(adminB,'GET',runtimePath)).statusCode,404);
  assert.equal((await request(maicLearner,'GET',runtimePath.replace('scene-one','missing-scene'))).statusCode,404);
  assert.equal((await request(maicLearner,'GET',runtimePath)).json().state.notes.reflection,'跨设备保存的学习反思');
  const progress=await request(maicLearner,'POST','/api/learn/progress',{courseId:cid,version:1,lessonId:'scene-one',eventId:randomUUID()});assert.equal(progress.statusCode,200,progress.body);
  const task=await request(root,'POST','/api/tenants/fujian/tasks',{title:'已完成课程再分配验收',description:'',start:new Date().toISOString().slice(0,10),due:new Date(Date.now()+86400000).toISOString().slice(0,10),sequential:true,courseIds:[cid],memberIds:[maicProvision.id],publish:true});assert.equal(task.statusCode,200,task.body);assert.deepEqual(task.json().completedMemberIds,[maicProvision.id]);
  const report=await request(root,'GET',`/api/tenants/fujian/reports/tasks/${task.json().id}`);assert.equal(report.statusCode,200,report.body);assert.equal(report.json().completed,1);assert.equal(report.json().items[0].stages[0].completedLessons,1);assert(report.json().items[0].lastActivity);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('制课步骤重启后过期租约转暂停，保留内容检查点并允许取消',async()=>{
 const source=(await db.query("SELECT * FROM authoring_jobs WHERE state='applied' ORDER BY created_at DESC LIMIT 1")).rows[0];assert.ok(source);
 const jid=randomUUID(),checkpoint={outlines:[{id:'restart-scene',type:'slide',title:'重启恢复',description:'恢复检查点',keyPoints:['保留课件'],order:1}],scenes:[],pendingContent:{outlineId:'restart-scene',content:{elements:[],background:{type:'solid',color:'#ffffff'}}}};
 await db.query("INSERT INTO authoring_jobs(id,tenant_id,course_id,actor_id,request_key,input_hash,input,state,revision,checkpoint,lease_token,lease_until) VALUES($1,$2,$3,$4,$5,$6,$7,'running_scenes',7,$8,'expired-worker',now()-interval '1 minute')",[jid,source.tenant_id,source.course_id,source.actor_id,randomUUID(),source.input_hash,JSON.stringify(source.input),JSON.stringify(checkpoint)]);
 await app.close();await db.close();db=await openDatabase(undefined,join(rootDir,'postgres'));await initialize(db,config);app=await buildApp(db,config);
 let detail:any;for(let i=0;i<40;i++){detail=(await request(root,'GET',`/api/tenants/fujian/authoring/jobs/${jid}`)).json();if(detail.state==='paused')break;await new Promise(resolve=>setTimeout(resolve,100));}
 assert.equal(detail.state,'paused');assert.equal(detail.revision,8);assert.equal(detail.completedScenes,0);assert.match(detail.error,/执行中断/);
 const retained=(await db.query('SELECT checkpoint,lease_token,lease_until FROM authoring_jobs WHERE id=$1',[jid])).rows[0];assert.deepEqual(retained.checkpoint.pendingContent,checkpoint.pendingContent);assert.equal(retained.lease_token,null);assert.equal(retained.lease_until,null);
 assert.equal(detail.events.filter((entry:any)=>entry.detail.includes('租约已过期')).length,1);
 const cancelled=await request(root,'POST',`/api/tenants/fujian/authoring/jobs/${jid}/commands`,{commandId:randomUUID(),revision:detail.revision,action:'cancel'});assert.equal(cancelled.statusCode,200,cancelled.body);assert.equal(cancelled.json().state,'cancelled');
});

test('任务明细导出覆盖全部分页、冻结版本和部门范围，并防止CSV公式注入',async()=>{
 const task=(await db.query("SELECT * FROM tasks WHERE title='已完成课程再分配验收'")).rows[0];assert.ok(task);
 const departments=(await db.query("SELECT departments FROM tenants WHERE id='fujian'")).rows[0].departments;const otherDepartment=departments.find((name:string)=>name!=='市场部');assert.ok(otherDepartment);
 await db.transaction(async tx=>{for(let index=0;index<31;index++){const memberId=randomUUID();await tx.query("INSERT INTO members(id,tenant_id,name,employee_no,department,role,active) VALUES($1,'fujian',$2,$3,$4,'学员',TRUE)",[memberId,index===0?'=2+2':index===30?'其他部门导出成员':`导出成员${index}`,`EXPORT-${index}`,index===30?otherDepartment:'市场部']);await tx.query("INSERT INTO assignments(tenant_id,task_id,member_id) VALUES('fujian',$1,$2)",[task.id,memberId]);}});
 const path=`/api/tenants/fujian/reports/tasks/${task.id}`,page=await request(root,'GET',path+'?limit=30');assert.equal(page.statusCode,200,page.body);assert.equal(page.json().total,32);assert.equal(page.json().items.length,30);
 const exported=await request(root,'GET',path+'/export');assert.equal(exported.statusCode,200,exported.body);assert.match(String(exported.headers['content-type']),/text\/csv/);assert.equal(exported.headers['cache-control'],'private, no-store');assert.match(String(exported.headers['content-disposition']),/attachment/);assert.equal(exported.rawPayload.subarray(0,3).toString('hex'),'efbbbf');assert.match(exported.body,/冻结版本/);assert.match(exported.body,/其他部门导出成员/);assert.match(exported.body,/'=2\+2/);assert.match(exported.body,/已完成/);
 for(let index=1;index<30;index++)assert.ok(exported.body.includes(`导出成员${index}`));
 const reportLearner=await login('maic-learner@test.local',password,'127.0.0.5');assert.equal((await request(reportLearner,'GET',path+'/export')).statusCode,403);assert.equal((await request(author,'GET',path+'/export')).statusCode,403);assert.equal((await request(adminB,'GET',`/api/tenants/haichuan/reports/tasks/${task.id}/export`)).statusCode,404);
 const authorMember=(await db.query("SELECT m.id FROM members m JOIN accounts a ON a.id=m.account_id WHERE a.email='author@test.local' AND m.tenant_id='fujian'")).rows[0];
 await db.query("UPDATE members SET role='部门管理员',department='市场部' WHERE id=$1",[authorMember.id]);
 try{const scopedPage=await request(author,'GET',path);assert.equal(scopedPage.statusCode,200);assert.equal(scopedPage.json().total,31);const scoped=await request(author,'GET',path+'/export');assert.equal(scoped.statusCode,200);assert.doesNotMatch(scoped.body,/其他部门导出成员/);assert.match(scoped.body,/导出成员29/);}finally{await db.query("UPDATE members SET role='内容作者' WHERE id=$1",[authorMember.id]);}
});

test('课程成员/部门范围、正文摘要、文件与助手历史引用统一授权且即时撤销',async()=>{
 const allowed=await provision('acl-a@test.local','学员'),denied=await provision('acl-b@test.local','学员');
 const boundary='acl-'+randomUUID(),text='蓝鲸私有资料：仅限授权学员阅读。';
 const upload=await request(root,'POST','/api/tenants/fujian/knowledge',Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="acl.md"\r\nContent-Type: text/markdown\r\n\r\n${text}\r\n--${boundary}--\r\n`),{'content-type':`multipart/form-data; boundary=${boundary}`});assert.equal(upload.statusCode,200,upload.body);const kid=upload.json().id;assert.equal(upload.json().audience.mode,'members');assert.deepEqual(upload.json().audience.memberIds,[]);
 const seed=(await request(root,'GET','/api/tenants/fujian/courses/fujian-c0')).json();
 const created=await request(root,'POST','/api/tenants/fujian/courses',{...seed,id:randomUUID(),title:'蓝鲸限定成员课程',knowledgeIds:[kid],audience:{mode:'members',departments:[],memberIds:[allowed.id]},publish:true});assert.equal(created.statusCode,200,created.body);const cid=created.json().id;
 const directory=await request(author,'GET','/api/tenants/fujian/content-directory');assert.equal(directory.statusCode,200,directory.body);assert(directory.json().items.every((m:any)=>Object.keys(m).every(key=>['id','name','department','active'].includes(key))));assert.equal((await request(denied.client,'GET','/api/tenants/fujian/content-directory')).statusCode,403);
 const deniedCatalog=(await request(denied.client,'GET','/api/learn/overview')).json();assert(!deniedCatalog.courses.some((c:any)=>c.id===cid));assert(deniedCatalog.courses.every((c:any)=>!c.classroom&&c.lessons.every((l:any)=>l.content==='')));
 assert.equal((await request(denied.client,'GET',`/api/learn/courses/${cid}/versions/1`)).statusCode,404);assert.equal((await request(allowed.client,'GET',`/api/learn/courses/${cid}/versions/1`)).statusCode,200);
 assert.equal((await request(allowed.client,'GET',`/api/learn/courses/${cid}/versions/1`)).json().audience,undefined);
 const filePath=`/api/learn/knowledge/${kid}/download?courseId=${cid}&version=1`;assert.equal((await request(denied.client,'GET',filePath)).statusCode,404);assert.equal((await request(allowed.client,'GET',filePath)).body,text);
 const date=new Date().toISOString().slice(0,10),due=new Date(Date.now()+86400000).toISOString().slice(0,10);
 assert.equal((await request(root,'POST','/api/tenants/fujian/tasks',{title:'越权分配',description:'',start:date,due,sequential:false,courseIds:[cid],memberIds:[denied.id],publish:true})).statusCode,400);
 const chat=(await request(allowed.client,'POST','/api/learn/assistant/sessions',{app:'faq',title:'蓝鲸知识'})).json();const response=await request(allowed.client,'POST',`/api/learn/assistant/sessions/${chat.id}/messages`,{id:randomUUID(),text:'蓝鲸'});assert.equal(response.statusCode,200,response.body);assert(response.json().sources.some((s:any)=>s.id===kid));
 const otherChat=(await request(denied.client,'POST','/api/learn/assistant/sessions',{app:'faq',title:'蓝鲸知识'})).json();const other=await request(denied.client,'POST',`/api/learn/assistant/sessions/${otherChat.id}/messages`,{id:randomUUID(),text:'蓝鲸'});assert(!other.json().sources.some((s:any)=>s.id===kid||s.id===cid));
 const course=(await request(root,'GET',`/api/tenants/fujian/courses/${cid}`)).json();assert.equal((await request(root,'PUT',`/api/tenants/fujian/courses/${cid}`,{...course,audience:{mode:'members',departments:[],memberIds:[denied.id]},publish:true})).statusCode,200);
 assert.equal((await request(allowed.client,'GET',`/api/learn/courses/${cid}/versions/1`)).statusCode,404);const history=await request(allowed.client,'GET',`/api/learn/assistant/sessions/${chat.id}`);assert.equal(history.statusCode,200,history.body);assert(!history.body.includes(text));assert.equal(history.json().messages[0].result.sources.length,0);
 assert.equal((await request(root,'PUT',`/api/tenants/fujian/courses/${cid}`,{...course,audience:{mode:'members',departments:[],memberIds:['haichuan-m1']},publish:true})).statusCode,400);
 const departmentCourse=(await request(root,'GET',`/api/tenants/fujian/courses/${cid}`)).json();assert.equal((await request(root,'PUT',`/api/tenants/fujian/courses/${cid}`,{...departmentCourse,audience:{mode:'departments',departments:['客户服务部'],memberIds:[]},publish:true})).statusCode,200);assert.equal((await request(denied.client,'GET',`/api/learn/courses/${cid}/versions/3`)).statusCode,404);
});

test('课程素材上传、冻结引用、学员权限、历史版本和媒体Range保持一致',async()=>{
 const student=await login('acl-b@test.local',password,'127.0.0.4'),member=(await request(student,'GET','/api/auth/me')).json().user.memberId;
 const seed=(await request(root,'GET','/api/tenants/fujian/courses/fujian-c0')).json();const draft=await request(root,'POST','/api/tenants/fujian/courses',{...seed,id:randomUUID(),title:'课程素材验收',publish:false});assert.equal(draft.statusCode,200,draft.body);const cid=draft.json().id;
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=','base64');
 const upload=async(client:Client,name:string,bytes=png,tenant='fujian')=>{const boundary='asset-'+randomUUID();return request(client,'POST',`/api/tenants/${tenant}/courses/${cid}/assets`,Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--\r\n`)]),{'content-type':`multipart/form-data; boundary=${boundary}`});};
 assert.equal((await upload(student,'a.png')).statusCode,403);assert.equal((await upload(adminB,'a.png',png,'haichuan')).statusCode,404);assert.equal((await upload(root,'a.svg',Buffer.from('<svg>danger</svg>'))).statusCode,400);assert.equal((await upload(root,'a.png',Buffer.from('this-is-not-a-png-image'))).statusCode,400);
 const first=await upload(root,'a.png');assert.equal(first.statusCode,200,first.body);const asset=first.json(),learn=`/api/learn/course-assets/${asset.id}`;assert.equal((await request(student,'GET',learn)).statusCode,404);assert.equal((await request(student,'GET',asset.src)).statusCode,403);assert.equal((await request(root,'GET',asset.src)).headers['content-type'],'image/png');
 assert.equal((await request(adminB,'GET',asset.src)).statusCode,404);assert((await request(root,'GET',`/api/tenants/fujian/courses/${cid}/assets`)).json().items.some((item:any)=>item.id===asset.id));
 const source=(await db.query("SELECT content FROM course_versions WHERE tenant_id='fujian' AND content ? 'classroom' ORDER BY version DESC LIMIT 1")).rows[0].content;const classroom=structuredClone(source.classroom),scene=classroom.scenes.find((scene:any)=>scene.type==='slide');assert(scene);classroom.scenes=[scene];scene.content.canvas.elements=[normalizeElement({id:randomUUID(),type:'image',left:60,top:60,width:200,height:100,src:asset.src})];
 const input={...draft.json(),classroom,lessons:[{id:scene.id,title:scene.title,format:'AI课堂',content:scene.id}],publish:true};const published=await request(root,'PUT',`/api/tenants/fujian/courses/${cid}`,input);assert.equal(published.statusCode,200,published.body);assert.equal(published.json().classroom.scenes[0].content.canvas.elements[0].src,learn);
 const full=await request(student,'GET',learn);assert.equal(full.statusCode,200,full.body);assert.deepEqual(full.rawPayload,png);const range=await request(student,'GET',learn,undefined,{range:'bytes=0-3'});assert.equal(range.statusCode,206);assert.deepEqual(range.rawPayload,png.subarray(0,4));assert.equal(range.headers['content-range'],`bytes 0-3/${png.length}`);assert.equal((await request(student,'GET',learn,undefined,{range:'bytes=999999-'})).statusCode,416);
 const date=new Date().toISOString().slice(0,10),due=new Date(Date.now()+86400000).toISOString().slice(0,10);const task=await request(root,'POST','/api/tenants/fujian/tasks',{title:'冻结素材v1',description:'',start:date,due,sequential:false,courseIds:[cid],memberIds:[member],publish:true});assert.equal(task.statusCode,200,task.body);
 const second=(await upload(root,'b.png')).json();const next=structuredClone(input);next.classroom.scenes[0].content.canvas.elements[0].src=second.src;assert.equal((await request(root,'PUT',`/api/tenants/fujian/courses/${cid}`,next)).statusCode,200);
 const other=await request(root,'POST','/api/tenants/fujian/courses',{...input,id:randomUUID(),title:'错误复用别课素材'});assert.equal(other.statusCode,400,other.body);
 assert.equal((await request(root,'POST',`/api/tenants/fujian/courses/${cid}/archive`,{})).statusCode,409);const draftAgain=(await request(root,'GET',`/api/tenants/fujian/courses/${cid}`)).json();assert.equal((await request(root,'PUT',`/api/tenants/fujian/courses/${cid}`,{...draftAgain,publish:false})).statusCode,200);assert.equal((await request(student,'GET',learn)).statusCode,200);assert.equal((await request(student,'GET',`/api/learn/course-assets/${second.id}`)).statusCode,404);
 const current=(await request(root,'GET',`/api/tenants/fujian/courses/${cid}`)).json();assert.equal((await request(root,'PUT',`/api/tenants/fujian/courses/${cid}`,{...current,publish:false,audience:{mode:'members',memberIds:[],departments:[]}})).statusCode,200);assert.equal((await request(student,'GET',learn)).statusCode,404);
});

test('主观题待评按冻结试卷确认分数，拒绝越权、超分和重复阅卷',async()=>{
 const candidate=await provision('review-learner@test.local','学员');const reviewLearner=candidate.client;
 const attemptId=randomUUID();const paper={passScore:80,questions:[{id:'objective',type:'single',title:'客观题',points:50,options:[{id:'A',text:'正确'}],answers:['A'],explanation:''},{id:'subjective',type:'text',title:'说明服务步骤',points:50,options:[],answers:['需求确认后推荐'],explanation:'按需求确认、方案匹配评分'}]};
 await db.query('INSERT INTO exam_attempts(id,tenant_id,member_id,course_id,course_version,paper,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[attemptId,'fujian',candidate.id,'fujian-c3',1,JSON.stringify(paper),new Date(Date.now()+60000)]);
 const submitted=await request(reviewLearner,'POST',`/api/learn/attempts/${attemptId}/submit`,{revision:0,answers:{objective:['A'],subjective:['先确认客户需求，再推荐方案。']}});assert.equal(submitted.statusCode,200,submitted.body);assert.equal(submitted.json().status,'pending_review');assert.equal(submitted.json().score,50);assert.equal(submitted.json().passed,null);
 const queue=(await request(root,'GET','/api/tenants/fujian/exam-attempts?status=pending_review')).json();assert(queue.items.some((r:any)=>r.id===attemptId&&r.course_title));
 const detail=(await request(root,'GET',`/api/tenants/fujian/exam-attempts/${attemptId}`)).json();assert.equal(detail.record.paper.questions[1].points,50);assert.equal(detail.record.course_content.version,1);
 assert.equal((await request(reviewLearner,'GET',`/api/tenants/fujian/exam-attempts/${attemptId}`)).statusCode,403);
 assert.equal((await request(adminB,'GET',`/api/tenants/haichuan/exam-attempts/${attemptId}`)).statusCode,404);
 assert.equal((await request(root,'POST',`/api/tenants/fujian/exam-attempts/${attemptId}/review`,{grades:{subjective:51}})).statusCode,400);
 const graded=await request(root,'POST',`/api/tenants/fujian/exam-attempts/${attemptId}/review`,{grades:{subjective:40}});assert.equal(graded.statusCode,200,graded.body);assert.equal(graded.json().score,90);assert.equal(graded.json().passed,true);
 assert.equal((await request(root,'POST',`/api/tenants/fujian/exam-attempts/${attemptId}/review`,{grades:{subjective:50}})).statusCode,409);
 const result=(await request(reviewLearner,'GET',`/api/learn/attempts/${attemptId}`)).json();assert.equal(result.status,'graded');assert.equal(result.score,90);
});

test('考试跨设备并发拒绝覆盖，保存响应丢失可安全重试，提交核对修订',async()=>{
 const candidate=await provision('exam-conflict@test.local','学员'),client=candidate.client;
 const started=(await request(client,'POST','/api/learn/exams/fujian-c3/attempts',{version:1})).json();assert.equal(started.answersRevision,0);const url=`/api/learn/attempts/${started.id}`;
 const first={'fujian-c3-q1':['A']},second={'fujian-c3-q1':['B']};
 const responses=await Promise.all([request(client,'PUT',url+'/answers',{answers:first,revision:0}),request(client,'PUT',url+'/answers',{answers:second,revision:0})]);assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409]);
 const saved=(await request(client,'GET',url)).json();assert.equal(saved.answersRevision,1);const current=saved.answers;const stale=current['fujian-c3-q1'][0]==='A'?second:first;
 const retry=await request(client,'PUT',url+'/answers',{answers:current,revision:0});assert.equal(retry.statusCode,200,retry.body);assert.equal(retry.json().revision,1);
 assert.equal((await request(client,'PUT',url+'/answers',{answers:stale})).json().error.code,'ANSWER_CONFLICT');
 const conflict=await request(client,'POST',url+'/submit',{answers:stale,revision:0});assert.equal(conflict.statusCode,409);assert.equal(conflict.json().error.code,'ANSWER_CONFLICT');assert.equal((await request(client,'GET',url)).json().status,'active');
 const updated=await request(client,'PUT',url+'/answers',{answers:stale,revision:1});assert.equal(updated.json().revision,2);
 const submitted=await request(client,'POST',url+'/submit',{answers:stale,revision:2});assert.equal(submitted.statusCode,200,submitted.body);assert.equal(submitted.json().answersRevision,3);assert.deepEqual(submitted.json().answers,stale);
 const replay=await request(client,'POST',url+'/submit',{answers:current,revision:0});assert.deepEqual(replay.json().answers,stale);assert.equal(replay.json().score,submitted.json().score);
 const expired=(await request(client,'POST','/api/learn/exams/fujian-c3/attempts',{version:1})).json();await request(client,'PUT',`/api/learn/attempts/${expired.id}/answers`,{answers:first,revision:0});await db.query("UPDATE exam_attempts SET expires_at=now()-interval '1 minute' WHERE id=$1",[expired.id]);
 const timedOut=await request(client,'POST',`/api/learn/attempts/${expired.id}/submit`,{answers:second,revision:0});assert.equal(timedOut.statusCode,200,timedOut.body);assert.deepEqual(timedOut.json().answers,first);assert.equal(timedOut.json().score,40);
});

test('页面企业或成员上下文改变后拒绝旧页面读写，me允许恢复当前身份',async()=>{
 const actor=(await request(root,'GET','/api/auth/me')).json().user;const context=`${actor.id}:${actor.tenantId}:${actor.memberId}`;
 assert.equal((await request(root,'GET','/api/learn/progress',undefined,{'x-ola-context':context})).statusCode,200);
 await request(root,'POST','/api/auth/switch-tenant',{tenantId:'haichuan'});root.tenant='haichuan';
 const blocked=await request(root,'GET','/api/learn/progress',undefined,{'x-ola-context':context});assert.equal(blocked.statusCode,403);assert.equal(blocked.json().error.code,'SESSION_CHANGED');
 assert.equal((await request(root,'POST','/api/learn/training',{courseId:'haichuan-c2',version:1},{'x-ola-context':context})).json().error.code,'SESSION_CHANGED');
 assert.equal((await request(root,'GET','/api/auth/me',undefined,{'x-ola-context':context})).json().user.tenantId,'haichuan');
 await request(root,'POST','/api/auth/switch-tenant',{tenantId:'fujian'});root.tenant='fujian';
 assert.equal((await request(author,'GET','/api/learn/progress',undefined,{'x-ola-context':context})).json().error.code,'SESSION_CHANGED');
});

test('题库启停与100分发布校验保持草稿、旧试卷及答卷不可变',async()=>{
 const student=await login('acl-b@test.local',password,'127.0.0.7'),template=(await request(root,'GET','/api/tenants/fujian/courses/fujian-c3')).json();
 const created=await request(root,'POST','/api/tenants/fujian/courses',{...template,id:randomUUID(),title:'题库管理验收',publish:false});assert.equal(created.statusCode,200,created.body);const cid=created.json().id,path=`/api/tenants/fujian/courses/${cid}`;let course=(await request(root,'GET',path)).json();
 assert.equal((await request(root,'PUT',path,{...course,publish:true})).statusCode,400);assert.equal((await request(root,'GET',path)).json().status,'draft');
 const q={id:randomUUID(),courseId:cid,type:'single',title:'先确认需求还是直接推荐？',options:[{id:'A',text:'先确认需求'},{id:'B',text:'直接推荐'}],answers:['A'],explanation:'先确认客户需求',points:20,active:false};
 assert.equal((await request(root,'POST','/api/tenants/fujian/questions',q)).statusCode,200);assert.equal((await request(root,'PUT',path,{...course,publish:true})).statusCode,400);
 const questionPath=`/api/tenants/fujian/questions/${q.id}`;assert.equal((await request(root,'PUT',questionPath,{...q,active:true})).statusCode,200);assert.equal((await request(root,'PUT',path,{...course,publish:true})).statusCode,400);
 assert.equal((await request(root,'PUT',questionPath,{...q,points:100,active:true})).statusCode,200);assert.equal((await request(root,'PUT',path,{...course,publish:true})).statusCode,200);
 const started=await request(student,'POST',`/api/learn/exams/${cid}/attempts`,{version:1});assert.equal(started.statusCode,200,started.body);assert.equal(started.json().paper.questions.length,1);assert(!('answers' in started.json().paper.questions[0]));
 assert.equal((await request(root,'PUT',questionPath,{...q,points:100,answers:['B'],active:false})).statusCode,200);course=(await request(root,'GET',path)).json();assert.equal((await request(root,'PUT',path,{...course,publish:true})).statusCode,400);assert.equal((await request(root,'GET',path)).json().version,1);
 const frozen=(await request(root,'GET',path+'/versions')).json().items[0].content.questions[0];assert.equal(frozen.active,true);assert.deepEqual(frozen.answers,['A']);
 assert.equal((await request(root,'PUT',questionPath,{...q,points:100,answers:['B'],active:true})).statusCode,200);assert.equal((await request(root,'PUT',path,{...course,publish:true})).json().version,2);
 const old=await request(student,'POST',`/api/learn/attempts/${started.json().id}/submit`,{revision:0,answers:{[q.id]:['A']}});assert.equal(old.statusCode,200,old.body);assert.equal(old.json().score,100);
 const current=(await request(student,'POST',`/api/learn/exams/${cid}/attempts`,{version:2})).json();assert.equal((await request(student,'POST',`/api/learn/attempts/${current.id}/submit`,{revision:0,answers:{[q.id]:['B']}})).json().score,100);
 assert.equal((await request(student,'GET','/api/tenants/fujian/questions')).statusCode,403);
});

test('自主考试原答卷跨版本继续保存提交，历史访问仍受当前范围控制',async()=>{
 const c=await login('acl-a@test.local',password,'127.0.0.6');const original=(await request(root,'GET','/api/tenants/fujian/courses/fujian-c3')).json();
 const started=await request(c,'POST','/api/learn/exams/fujian-c3/attempts',{version:original.version});assert.equal(started.statusCode,200,started.body);const attempt=started.json(),path=`/api/learn/attempts/${attempt.id}`;
 const changed=await request(root,'PUT','/api/tenants/fujian/courses/fujian-c3',{...original,title:'自主考试新版',publish:true});assert.equal(changed.statusCode,200,changed.body);
 const historical=await request(c,'GET',path);assert.equal(historical.statusCode,200,historical.body);assert.equal(historical.json().version,original.version);assert.deepEqual(historical.json().paper,attempt.paper);assert(historical.json().paper.questions.every((q:any)=>!('answers' in q)));
 assert.equal((await request(c,'GET',`/api/learn/courses/fujian-c3/versions/${original.version}`)).statusCode,404);
 const saved=await request(c,'PUT',path+'/answers',{answers:{},revision:0});assert.equal(saved.statusCode,200,saved.body);const submitted=await request(c,'POST',path+'/submit',{answers:{},revision:saved.json().revision});assert.equal(submitted.statusCode,200,submitted.body);assert.notEqual(submitted.json().status,'active');
 assert.equal((await request(author,'GET',path)).statusCode,404);
 const scoped=await request(root,'PUT','/api/tenants/fujian/courses/fujian-c3',{...(changed.json() as any),audience:{mode:'members',memberIds:[(await db.query("SELECT id FROM members WHERE tenant_id='fujian' AND employee_no='ADMIN'")).rows[0].id],departments:[]},publish:true});assert.equal(scoped.statusCode,200,scoped.body);assert.equal((await request(c,'GET',path)).statusCode,404);
 const restored=await request(root,'PUT','/api/tenants/fujian/courses/fujian-c3',{...(scoped.json() as any),audience:original.audience||{mode:'enterprise',memberIds:[],departments:[]},publish:true});assert.equal(restored.statusCode,200,restored.body);
});

test('关闭服务并重开落盘PostgreSQL后，数据和完整历史版本仍存在',async()=>{
 await app.close();await db.close();db=await openDatabase(undefined,join(rootDir,'postgres'));await initialize(db,config);app=await buildApp(db,config);root=await login(config.adminEmail);const course=await request(root,'GET',`/api/tenants/fujian/courses/${courseId}`);assert.equal(course.statusCode,200);assert.equal(course.json().title,'课程修订');const versions=(await request(root,'GET',`/api/tenants/fujian/courses/${courseId}/versions`)).json();assert.equal(versions.items[0].content.lessons[0].content,'原始课程正文');assert.equal((await request(root,'GET',`/api/tenants/fujian/knowledge/${fileId}/download`)).body,'# 测试知识\n服务正文');
});




test('管理端传输使用真实认证钩子恢复令牌并阻止跨企业旧请求',async()=>{
 const actor=(await request(root,'GET','/api/auth/me')).json().user;
 let calls=0,expired=0;
 const transport=new AdminTransport({fetch:async(input,init)=>{
  calls++;
  const result=await app.inject({url:String(input),method:(init?.method||'GET') as any,headers:{cookie:root.cookie,...init?.headers as Record<string,string>},payload:init?.body as string|undefined});
  return new Response(result.body,{status:result.statusCode,headers:{'content-type':'application/json'}});
 },onExpired:()=>expired++});
 transport.setSession(actor,'intentionally-stale');
 try{
  await transport.request('/auth/switch-tenant','POST',{tenantId:'haichuan'});
  assert.equal(calls,3);assert.equal(expired,0);
  assert.equal((await request(root,'GET','/api/auth/me')).json().user.tenantId,'haichuan');
  // Cookie now belongs to the other enterprise; the old page must not switch it back.
  await assert.rejects(transport.request('/auth/switch-tenant','POST',{tenantId:'fujian'}),{code:'SESSION_CHANGED'});
  assert.equal(calls,4);assert.equal(expired,1);
  assert.equal((await request(root,'GET','/api/auth/me')).json().user.tenantId,'haichuan');
 }finally{assert.equal((await request(root,'POST','/api/auth/switch-tenant',{tenantId:'fujian'})).statusCode,200);}
});


test('超级助手按当前学员权限与版本返回真实待学课程，重复发送保持幂等',async()=>{
 root=await login(config.adminEmail);
 const actor=await provision('assistant-progress@test.local','学员');
 const template=(await request(root,'GET','/api/tenants/fujian/courses/fujian-c0')).json();
 const seeded=await request(root,'POST','/api/tenants/fujian/courses',{...template,id:randomUUID(),title:'助手进度专用课程',kind:'learn',classroom:undefined,audience:{mode:'enterprise',departments:[],memberIds:[]},lessons:[{id:randomUUID(),title:'第一课',format:'文档',content:'第一课正文'},{id:randomUUID(),title:'第二课',format:'文档',content:'第二课正文'}],publish:true});assert.equal(seeded.statusCode,200,seeded.body);
 const overview=(await request(actor.client,'GET','/api/learn/overview')).json();
 const candidate=overview.courses.find((c:any)=>c.id===seeded.json().id);
 assert(candidate,'需要至少一个多课时学习课程');
 const marked=await request(actor.client,'POST','/api/learn/progress',{courseId:candidate.id,version:candidate.version,lessonId:candidate.lessons[0].id,eventId:randomUUID()});assert.equal(marked.statusCode,200,marked.body);
 const updated=(await request(actor.client,'GET','/api/learn/overview')).json();
 const expected=updated.courses.filter((c:any)=>c.kind==='learn'&&!updated.completed.includes(c.id+':'+c.version));
 const chat=(await request(actor.client,'POST','/api/learn/assistant/sessions',{app:'terminal',title:'待学课程查询'})).json();
 const payload={id:randomUUID(),text:'我有哪些课程没完成？'};
 const response=await request(actor.client,'POST',`/api/learn/assistant/sessions/${chat.id}/messages`,payload);assert.equal(response.statusCode,200,response.body);
 const answer=response.json();assert.equal(answer.mode,'learning');assert.equal(answer.total,expected.length);assert.match(answer.message,new RegExp(String(expected.length)));
 assert.equal(answer.sources[0].id,candidate.id);assert.equal(answer.sources[0].version,candidate.version);assert.equal(answer.sources[0].progress,Math.round(100/candidate.lessons.length));
 assert(answer.sources.every((source:any)=>expected.some((c:any)=>c.id===source.id&&c.version===source.version)));assert(answer.sources.every((source:any)=>!('questions' in source)&&!('lessons' in source)));
 const retry=await request(actor.client,'POST',`/api/learn/assistant/sessions/${chat.id}/messages`,payload);assert.equal(retry.statusCode,200,retry.body);assert.deepEqual(retry.json(),answer);
 const stored=(await request(actor.client,'GET',`/api/learn/assistant/sessions/${chat.id}`)).json();assert.equal(stored.messages.length,1);assert.equal(stored.messages[0].result.mode,'learning');
 assert.equal((await request(adminB,'GET',`/api/learn/assistant/sessions/${chat.id}`)).statusCode,404);
});


test('Tailscale 三端来源允许登录请求，其他来源仍拒绝且 CSRF 不绕过',async()=>{
 for(const origin of config.allowedOrigins!){
  const login=await app.inject({method:'POST',url:'/api/auth/login',headers:{origin},payload:{},remoteAddress:'127.0.0.88'});
  assert.equal(login.statusCode,400,login.body);
  const missingCsrf=await app.inject({method:'POST',url:'/api/auth/switch-tenant',headers:{origin,cookie:root.cookie},payload:{tenantId:root.tenant}});
  assert.equal(missingCsrf.statusCode,403);
  assert.equal(missingCsrf.json().error.code,'CSRF_REFUSED');
 }
 for(const origin of ['http://100.64.0.7:4173','http://100.64.0.6:4173.evil.invalid']){
  const denied=await app.inject({method:'POST',url:'/api/auth/login',headers:{origin},payload:{}});
  assert.equal(denied.statusCode,403);
  assert.equal(denied.json().error.code,'ORIGIN_REFUSED');
 }
});
