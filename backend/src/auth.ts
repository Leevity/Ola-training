import {sessionContext} from '../../shared/session-context.ts';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Database } from './db.ts';
import type { Config } from './config.ts';
import { accountInput, id, loginInput } from './schemas.ts';
import { bad, forbidden, HttpError } from './errors.ts';
const scrypt=promisify(scryptCallback);
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64) as Buffer;return `scrypt:${salt}:${key.toString('hex')}`;}
export async function verifyPassword(password:string,encoded:string){const[,salt,hash]=encoded.split(':');if(!salt||!hash)return false;const key=await scrypt(password,salt,64) as Buffer;const expected=Buffer.from(hash,'hex');return expected.length===key.length&&timingSafeEqual(key,expected);}
export type Actor={accountId:string;email:string;platformAdmin:boolean;tenantId:string;memberId:string;name:string;role:string;department:string;csrf:string;sessionHash:string};
declare module 'fastify' {interface FastifyRequest {actor?:Actor;}}
export async function authenticate(req:FastifyRequest,db:Database):Promise<Actor>{
  const token=req.headers['x-ola-client']==='learner'?req.cookies.ola_learner_session:req.url.startsWith('/api/learn/')?(req.cookies.ola_learner_session||req.cookies.ola_session):req.cookies.ola_session;
  if(!token||!/^[a-f0-9]{64}$/.test(token))throw new HttpError(401,'UNAUTHENTICATED','请先登录');
  const sessionHash=tokenHash(token);
  const {rows}=await db.query(`SELECT s.*,a.email,a.platform_admin,m.id AS member_id,m.name,m.role,m.department
    FROM sessions s JOIN accounts a ON a.id=s.account_id JOIN members m ON m.tenant_id=s.tenant_id AND m.account_id=a.id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND a.active=TRUE AND m.active=TRUE`,[sessionHash]);
  const r=rows[0];if(!r)throw new HttpError(401,'UNAUTHENTICATED','登录已失效，请重新登录');
  return {accountId:r.account_id,email:r.email,platformAdmin:r.platform_admin,tenantId:r.tenant_id,memberId:r.member_id,name:r.name,role:r.role,department:r.department,csrf:r.csrf_token,sessionHash};
}
export const isManager=(a:Actor)=>['企业管理员','内容作者'].includes(a.role);
export function requireContent(a:Actor){if(!isManager(a))throw forbidden();}
export function requireAdmin(a:Actor){if(a.role!=='企业管理员')throw forbidden();}
export function requireStaff(a:Actor){if(a.role==='学员')throw forbidden();}
export function requireTenant(req:FastifyRequest){const params=req.params as {tenantId?:string};if(params.tenantId&&params.tenantId!==req.actor!.tenantId)throw forbidden();return req.actor!;}
export async function registerAuth(app:FastifyInstance,db:Database,config:Config){
  const dummy=await hashPassword(randomBytes(24).toString('hex'));
  app.addHook('preHandler',async(req)=>{
    const path=req.url.split('?')[0];
    if(req.method!=='GET'&&req.method!=='HEAD'&&req.headers.origin&&![config.origin,config.learnerOrigin,config.mobileOrigin,...(config.allowedOrigins||[])].includes(req.headers.origin))throw new HttpError(403,'ORIGIN_REFUSED','请求来源不被允许');
    if(path==='/api/health'||path==='/api/auth/login')return;
    if(!path.startsWith('/api/'))return;
    req.actor=await authenticate(req,db);
    if(path!=='/api/auth/me'&&req.headers['x-ola-context']&&req.headers['x-ola-context']!==sessionContext({id:req.actor.accountId,tenantId:req.actor.tenantId,memberId:req.actor.memberId}))throw new HttpError(403,'SESSION_CHANGED','登录身份或企业已变化，请重新进入学习空间');
    if(req.method!=='GET'&&req.method!=='HEAD'&&req.headers['x-csrf-token']!==req.actor.csrf)throw new HttpError(403,'CSRF_REFUSED','安全校验失败，请刷新页面');
  });
  app.post('/api/auth/login',{config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(req,reply)=>{
    const input=loginInput.parse(req.body);const {rows}=await db.query('SELECT * FROM accounts WHERE email=$1',[input.email]);const account=rows[0];
    const valid=await verifyPassword(input.password,account?.password_hash||dummy);
    if(!account||!account.active||!valid)throw new HttpError(401,'INVALID_CREDENTIAL','账号或密码不正确');
    const memberships=await db.query('SELECT tenant_id FROM members WHERE account_id=$1 AND active=TRUE ORDER BY tenant_id',[account.id]);
    if(!memberships.rows.length)throw forbidden();
    const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');
    await db.query('DELETE FROM sessions WHERE expires_at<=now()');
    await db.query('INSERT INTO sessions(token_hash,account_id,tenant_id,csrf_token,expires_at) VALUES($1,$2,$3,$4,$5)',[tokenHash(token),account.id,memberships.rows[0].tenant_id,csrf,new Date(Date.now()+config.sessionHours*3600000)]);
    reply.setCookie(req.headers['x-ola-client']==='learner'?'ola_learner_session':'ola_session',token,{httpOnly:true,secure:config.production,sameSite:'strict',path:'/api',maxAge:config.sessionHours*3600});
    return {ok:true,csrf};
  });
  app.get('/api/auth/me',async(req)=>({user:publicActor(req.actor!),csrf:req.actor!.csrf,tenants:(await db.query('SELECT t.id,t.name,t.short_name AS "shortName" FROM tenants t JOIN members m ON m.tenant_id=t.id WHERE m.account_id=$1 AND m.active=TRUE ORDER BY t.id',[req.actor!.accountId])).rows}));
  app.post('/api/auth/logout',async(req,reply)=>{await db.query('DELETE FROM sessions WHERE token_hash=$1',[req.actor!.sessionHash]);reply.clearCookie(req.headers['x-ola-client']==='learner'?'ola_learner_session':'ola_session',{path:'/api'});return {ok:true};});
  app.post('/api/auth/switch-tenant',async req=>{const tenantId=id.parse((req.body as any)?.tenantId);const membership=await db.query('SELECT 1 FROM members WHERE tenant_id=$1 AND account_id=$2 AND active=TRUE',[tenantId,req.actor!.accountId]);if(!membership.rows.length)throw forbidden();await db.query('UPDATE sessions SET tenant_id=$1 WHERE token_hash=$2',[tenantId,req.actor!.sessionHash]);return {ok:true};});
  app.post('/api/auth/password',async(req,reply)=>{const input=accountInput.pick({password:true}).extend({currentPassword:loginInput.shape.password}).parse(req.body);const account=(await db.query('SELECT password_hash FROM accounts WHERE id=$1',[req.actor!.accountId])).rows[0];if(!await verifyPassword(input.currentPassword,account.password_hash))throw bad('当前密码不正确');const hash=await hashPassword(input.password);await db.transaction(async tx=>{await tx.query('UPDATE accounts SET password_hash=$1 WHERE id=$2',[hash,req.actor!.accountId]);await tx.query('DELETE FROM sessions WHERE account_id=$1',[req.actor!.accountId]);});reply.clearCookie(req.headers['x-ola-client']==='learner'?'ola_learner_session':'ola_session',{path:'/api'});return {ok:true};});
}
export const publicActor=(a:Actor)=>({id:a.accountId,email:a.email,name:a.name,role:a.role,tenantId:a.tenantId,memberId:a.memberId,department:a.department,platformAdmin:a.platformAdmin});
