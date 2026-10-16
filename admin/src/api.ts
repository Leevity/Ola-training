import { randomId } from '../../shared/random-id.ts';
import type { Database, Tenant } from './domain';
export type Identity={id:string;email:string;name:string;role:string;tenantId:string;memberId:string;department:string;platformAdmin:boolean};
export type Snapshot={db:Database;revision:number;error?:string};
import {AdminTransport} from './transport.ts';
export {ApiError} from './transport.ts';
let revision=import.meta.hot?.data.revision||0;let tenantId=import.meta.hot?.data.tenantId||'';
const transport=new AdminTransport({onExpired:()=>window.dispatchEvent(new Event('ola:session-expired'))}, {csrf:import.meta.hot?.data.csrf||'',context:import.meta.hot?.data.context||''});
import.meta.hot?.dispose(data=>{data.csrf=transport.csrf;data.context=transport.context;data.revision=revision;data.tenantId=tenantId;});
const request=<T>(path:string,method='GET',body?:unknown,headers:Record<string,string>={},raw=false)=>transport.request<T>(path,method,body,headers,raw);
export async function login(email:string,password:string){const result=await request<{csrf:string}>('/auth/login','POST',{email,password});transport.clear();transport.csrf=result.csrf;}
export async function me(){const result=await request<{user:Identity;csrf:string}>('/auth/me');transport.setSession(result.user,result.csrf);tenantId=result.user.tenantId;return result.user;}
export async function bootstrap(){const result=await request<Snapshot>('/bootstrap');revision=result.revision;return result;}
export async function logout(){await request('/auth/logout','POST',{});transport.clear();tenantId='';revision=0;}
export async function switchTenant(id:string){await request('/auth/switch-tenant','POST',{tenantId:id});}
const base=()=>`/tenants/${encodeURIComponent(tenantId)}`;
const changed=<T extends {id:string}>(before:T[],after:T[])=>after.filter(next=>JSON.stringify(before.find(x=>x.id===next.id))!==JSON.stringify(next));
export async function persistChange(before:Database,after:Database){
 const courses=changed(before.courses,after.courses),tasks=changed(before.tasks,after.tasks),members=changed(before.members,after.members),knowledge=changed(before.knowledge,after.knowledge),tenants=changed(before.tenants,after.tenants);
 if(courses.length+tasks.length+members.length+knowledge.length+tenants.length!==1)throw new Error('每次操作必须对应一条业务记录');
 const headers={'if-match':String(revision)};
 if(courses.length){const c=courses[0];const old=before.courses.find(x=>x.id===c.id);const url=`${base()}/courses/${encodeURIComponent(c.id)}`;if(c.status==='archived')await request(url+'/archive','POST',{},headers);else if(old?.status==='archived')await request(url+'/restore','POST',{},headers);else await request(old?url:`${base()}/courses`,old?'PUT':'POST',{...c,publish:c.status==='published'},headers);}
 if(tasks.length){const t=tasks[0];const old=before.tasks.find(x=>x.id===t.id);const url=`${base()}/tasks/${encodeURIComponent(t.id)}`;if(t.status==='archived')await request(url+'/archive','POST',{},headers);else await request(old?url:`${base()}/tasks`,old?'PUT':'POST',{...t,publish:t.status==='published'},headers);}
 if(members.length){const m=members[0];const old=before.members.find(x=>x.id===m.id);await request(old?`${base()}/members/${encodeURIComponent(m.id)}`:`${base()}/members`,old?'PUT':'POST',m,headers);}
 if(knowledge.length){const k=knowledge[0];if(!before.knowledge.some(x=>x.id===k.id))throw new Error('文件须通过上传接口创建');await request(`${base()}/knowledge/${encodeURIComponent(k.id)}/${k.status==='archived'?'archive':'restore'}`,'POST',{},headers);}
 if(tenants.length)await request(`${base()}/settings`,'PUT',tenants[0],headers);
 return bootstrap();
}
export async function uploadFile(file:File,category:string){const form=new FormData();form.append('category',category);form.append('file',file);await request(`${base()}/knowledge`,'POST',form,{'if-match':String(revision)});return bootstrap();}
export async function getFile(key:string):Promise<Blob>{const [scope,id]=key.split(':');if(scope!==tenantId||!id)throw new Error('文件企业范围不一致');return request<Blob>(`${base()}/knowledge/${encodeURIComponent(id)}/download`,'GET',undefined,{},true);}
export const integrationStatus=()=>request<{configured:boolean;connected:boolean}>(`${base()}/integrations/openmaic/status`);
export const localAuthoringStatus=()=>request<{configured:boolean;model:string|null}>(`${base()}/authoring/status`);
export const localAuthoringJobs=()=>request<{items:any[]}>(`${base()}/authoring/jobs`);
export const localAuthoringJob=(id:string)=>request<any>(`${base()}/authoring/jobs/${encodeURIComponent(id)}`);
export const startLocalAuthoring=(input:{courseId:string;requirement:string;knowledgeIds:string[]},key:string)=>request<any>(`${base()}/authoring/jobs`,'POST',input,{'idempotency-key':key});
export const saveLocalOutline=(id:string,revision:number,outlines:unknown[])=>request<any>(`${base()}/authoring/jobs/${encodeURIComponent(id)}/outline`,'PUT',{revision,outlines});
export const localAuthoringCommand=(id:string,revision:number,action:'confirm'|'retry'|'cancel'|'apply',courseUpdatedAt?:string)=>request<any>(`${base()}/authoring/jobs/${encodeURIComponent(id)}/commands`,'POST',{commandId:randomId(),revision,action,...(courseUpdatedAt?{courseUpdatedAt}:{})});
export const parseMaterial=(id:string)=>request(`${base()}/knowledge/${encodeURIComponent(id)}/parse`,'POST',{});
export const setKnowledgeAudience=(id:string,audience:import('../../shared/audience.ts').Audience,expectedAudience:import('../../shared/audience.ts').Audience)=>request(`${base()}/knowledge/${encodeURIComponent(id)}/audience`,'PUT',{...audience,expectedAudience},{'if-match':String(revision)});
export const contentDirectory=()=>request<{items:Pick<import('./domain').Member,'id'|'name'|'department'|'active'>[]}>(`${base()}/content-directory`);
export const taskReport=(id:string,offset=0)=>request<any>(`${base()}/reports/tasks/${encodeURIComponent(id)}?limit=30&offset=${offset}`);
export type ReviewResource='training'|'exam-attempts';
export const reviewQueue=(resource:ReviewResource,offset=0)=>request<{items:any[]}>(`${base()}/${resource}?status=pending_review&limit=20&offset=${offset}`);
export const reviewDetail=(resource:ReviewResource,id:string)=>request<any>(`${base()}/${resource}/${encodeURIComponent(id)}`);
export const submitReview=(resource:ReviewResource,id:string,input:unknown)=>request(`${base()}/${resource}/${encodeURIComponent(id)}/review`,'POST',input,{'if-match':String(revision)});
export type AIProviderSettings={configured:boolean;baseUrl:string;model:string;hasKey:boolean;updatedAt?:string};
export const aiProvider=()=>request<AIProviderSettings>(`${base()}/ai/provider`);
export const saveAIProvider=async(input:{baseUrl:string;model:string;apiKey?:string})=>{const result=await request(`${base()}/ai/provider`,'PUT',input);await bootstrap();return result;};
export const testAIProvider=()=>request<{connected:boolean;model:string;latencyMs:number}>(`${base()}/ai/provider/test`,'POST',{});
export const generationJobs=()=>request<{items:any[]}>(`${base()}/integrations/openmaic/jobs`);
export const startGeneration=(courseId:string,requirement:string,key:string)=>request<{id:string;state:string}>(`${base()}/integrations/openmaic/jobs`,'POST',{courseId,requirement},{'if-match':String(revision),'idempotency-key':key});
export const refreshGeneration=(id:string)=>request<any>(`${base()}/integrations/openmaic/jobs/${encodeURIComponent(id)}`);
export const generationCommand=(id:string,action:'confirm-outline'|'retry',outlineRevision?:number)=>request<any>(`${base()}/integrations/openmaic/jobs/${encodeURIComponent(id)}/command`,'POST',{action,commandId:randomId(),...(outlineRevision?{outlineRevision}:{})});
export const provisionAccount=(memberId:string,email:string,password:string)=>request(`${base()}/members/${encodeURIComponent(memberId)}/account`,'POST',{email,password},{'if-match':String(revision)});
export const createTenant=(tenant:Omit<Tenant,'id'>)=>request<{id:string}>('/platform/tenants','POST',tenant);

export type CourseAsset={id:string;src:string;name:string;mime:string;ext:string;size:number};
export const courseAssets=(courseId:string)=>request<{items:CourseAsset[]}>(`${base()}/courses/${encodeURIComponent(courseId)}/assets`);
export async function uploadCourseAsset(courseId:string,file:File){const form=new FormData();form.append('file',file);const result=await request<CourseAsset>(`${base()}/courses/${encodeURIComponent(courseId)}/assets`,'POST',form,{'if-match':String(revision)});await bootstrap();return result;}

export const exportTaskReport=(id:string)=>request<Blob>(`${base()}/reports/tasks/${encodeURIComponent(id)}/export`,'GET',undefined,{},true);

export type ExamQuestion={id:string;courseId:string;type:'single'|'multiple'|'boolean'|'fill'|'text';title:string;options:{id:string;text:string}[];answers:string[];explanation:string;points:number;active?:boolean};
export const examQuestions=()=>request<{items:ExamQuestion[]}>(`${base()}/questions`);
export async function saveExamQuestion(question:ExamQuestion,create:boolean){const result=await request<{id:string}>(`${base()}/questions${create?'':'/'+encodeURIComponent(question.id)}`,create?'POST':'PUT',question,{'if-match':String(revision)});await bootstrap();return result;}

export const courseForEditing=(id:string)=>request<import('./domain').Course>(`${base()}/courses/${encodeURIComponent(id)}`);
