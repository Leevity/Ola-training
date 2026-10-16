import {registerCourseAssets} from './course-assets.ts';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import type { Database } from './db.ts';
import type { Config } from './config.ts';
import { HttpError } from './errors.ts';
import { registerAuth } from './auth.ts';
import { registerAdmin } from './admin.ts';
import { registerLearning } from './learning.ts';
import { registerIntegration } from './integration.ts';
import { registerPortal } from './portal.ts';
import { registerAIProvider } from './ai-provider.ts';
import { registerAuthoring } from './authoring.ts';
import { registerMaterialParser } from './material-parser.ts';
import { registerClassroomRuntime } from './classroom-runtime.ts';
import { registerTaskReports } from './task-reports.ts';
export async function buildApp(db:Database,config:Config,logger=false){
 const app=Fastify({logger:logger?{redact:['req.headers.cookie','req.headers.authorization','req.headers["x-csrf-token"]','body.password','body.currentPassword','body.apiKey']}:false,bodyLimit:2*1024*1024,requestTimeout:120000,trustProxy:false});
 await app.register(cookie);await app.register(helmet,{contentSecurityPolicy:false});await app.register(multipart,{limits:{fileSize:10*1024*1024,files:1,fields:2,parts:3}});await app.register(rateLimit,{global:true,max:600,timeWindow:'1 minute'});
 app.setErrorHandler((error,req,reply)=>{
  if(error instanceof HttpError)return reply.code(error.status).send({error:{code:error.code,message:error.message},requestId:req.id});
  if(error instanceof ZodError)return reply.code(400).send({error:{code:'INVALID_REQUEST',message:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).slice(0,5).join('；')},requestId:req.id});
  const e=error as any;
  if(e.code==='23505')return reply.code(409).send({error:{code:'CONFLICT',message:e.constraint==='authoring_active_course'?'该课程已有其他未完成的制课任务，请先完成或取消该任务，再重试。':'记录或编号已存在'},requestId:req.id});
  if(e.code==='23503')return reply.code(400).send({error:{code:'INVALID_REFERENCE',message:'关联记录不存在或不可访问'},requestId:req.id});
  if(e.statusCode&&e.statusCode<500)return reply.code(e.statusCode).send({error:{code:e.code||'INVALID_REQUEST',message:e.statusCode===413?'文件或请求过大':'请求格式不正确'},requestId:req.id});
  req.log.error(error,'Request failed');return reply.code(500).send({error:{code:'INTERNAL_ERROR',message:'服务处理失败，请稍后重试'},requestId:req.id});
 });
 await registerAuth(app,db,config);
 app.get('/api/health',async()=>{await db.query('SELECT 1');return {ok:true,database:db.kind};});
 await registerCourseAssets(app,db,config);await registerAdmin(app,db,config);await registerLearning(app,db);await registerIntegration(app,db,config);await registerPortal(app,db,config);await registerAIProvider(app,db,config);await registerMaterialParser(app,db,config);await registerAuthoring(app,db,config);await registerClassroomRuntime(app,db);await registerTaskReports(app,db);
 return app;
}
