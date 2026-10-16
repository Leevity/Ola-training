import { randomId } from './random-id.ts';
import type { ClassroomDocument } from './classroom.ts';
import type { Audience } from './audience.ts';
export type Kind = 'learn' | 'train' | 'exam';
export type Status = 'draft' | 'published' | 'archived';
export type Lesson = {id: string; title: string; format: string; content: string};
export type Course = {id: string; tenantId: string; title: string; summary: string; category: string; kind: Kind; status: Status; cover: string; duration: number; lessons: Lesson[]; knowledgeIds: string[]; trainingMode: string; role: string; objective: string; rubric: string; examPass: number; examMinutes: number; examAttempts: number; version: number; updatedAt: string; classroom?:ClassroomDocument;audience?:Audience;questionCount?:number};
export type Member = {id: string; tenantId: string; name: string; employeeNo: string; department: string; role: string; active: boolean; email?: string};
export type CourseSnapshot = {id: string; title: string; kind: Kind; version: number};
export type Task = {id: string; tenantId: string; title: string; description: string; start: string; due: string; status: Status; sequential: boolean; courseIds: string[]; memberIds: string[]; snapshot: CourseSnapshot[]; assignedAt?: string; completedMemberIds: string[]};
export type Knowledge = {id: string; tenantId: string; name: string; category: string; size: number; mime: string; status: 'ready' | 'pending' | 'archived'; text?: string; hasBlob: boolean; updatedAt: string; parseError?:string; parsing?:boolean; pageCount?:number;audience?:Audience};
export type Audit = {id: string; tenantId: string; action: string; target: string; at: string};
export type Tenant = {id: string; name: string; shortName: string; departments: string[]; description: string};
export type Database = {schemaVersion: 1; tenants: Tenant[]; courses: Course[]; tasks: Task[]; members: Member[]; knowledge: Knowledge[]; audit: Audit[]};
export const kindLabels: Record<Kind,string> = {learn:'学习课程', train:'训练课程', exam:'考试课程'};
export const statusLabels: Record<Status,string> = {draft:'草稿',published:'已发布',archived:'已归档'};
export const uid = () => randomId();
export const timestamp = () => new Date().toISOString();
export function validateCourse(c: Course, knowledge: Knowledge[], publish = false): string {
  if (!c.title.trim()) return '请填写课程名称';
  if (!Number.isInteger(c.duration) || c.duration < 1 || c.duration > 9999) return '预计时长必须为 1 至 9999 的整数';
  if (c.knowledgeIds.some(id => !knowledge.some(k => k.id === id && k.tenantId === c.tenantId && k.status !== 'archived'))) return '关联知识文件已失效，请重新选择';
  if (!publish) return '';
  if (!c.summary.trim()) return '发布前请填写课程简介';
  if (c.kind === 'learn' && (!c.lessons.length || c.lessons.some(l => !l.title.trim() || !l.content.trim()))) return '发布前请补齐每个课时的名称与内容';
  if (c.kind === 'learn' && c.lessons.some(l => l.format === '视频链接' && !/^https?:\/\/\S+$/i.test(l.content.trim()))) return '视频课时请填写有效的 HTTP 或 HTTPS 地址';
  if (c.kind === 'train' && (!c.role.trim() || !c.objective.trim() || !c.rubric.trim())) return '发布前请补齐角色、训练目标与评价标准';
  if (c.kind === 'exam' && (![c.examPass,c.examMinutes,c.examAttempts].every(Number.isInteger) || c.examPass < 1 || c.examPass > 100 || c.examMinutes < 1 || c.examAttempts < 1)) return '请设置有效的合格分数、考试时长与次数';
  return '';
}
export function validateTask(t: Task, courses: Course[], members: Member[], publish = false): string {
  if (!t.title.trim()) return '请填写任务名称';
  const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
  if (!validDate(t.start) || !validDate(t.due) || t.start > t.due) return '请选择有效日期，截止日期不能早于开始日期';
  if (!publish) return '';
  if (!t.courseIds.length) return '请至少选择一门课程';
  if (!t.memberIds.length) return '请至少选择一名接收成员';
  if (new Set(t.courseIds).size !== t.courseIds.length || new Set(t.memberIds).size !== t.memberIds.length) return '课程或成员不能重复';
  if (t.courseIds.some(id => !courses.some(c => c.id === id && c.tenantId === t.tenantId && c.status === 'published'))) return '任务只能关联本企业已发布的课程';
  if (t.memberIds.some(id => !members.some(m => m.id === id && m.tenantId === t.tenantId && m.active))) return '任务只能分配给本企业已启用的成员';
  return '';
}
export function publishTask(t: Task, courses: Course[], members: Member[]): Task {
  const error = validateTask(t,courses,members,true);
  if (error) throw new Error(error);
  if (t.status !== 'draft') throw new Error('只有草稿任务可以发布');
  return {...t,status:'published',assignedAt:timestamp(),snapshot:t.courseIds.map(id => {
    const c = courses.find(c => c.id === id && c.tenantId === t.tenantId)!;
    return {id:c.id,title:c.title,kind:c.kind,version:c.version};
  }),memberIds:[...t.memberIds]};
}
export function archiveCourse(id: string, db: Database, tenantId: string): Database {
  const course = db.courses.find(c=>c.id === id && c.tenantId === tenantId);
  if (!course) throw new Error('课程不存在');
  if (db.tasks.some(t=>t.tenantId === tenantId && t.status === 'published' && t.courseIds.includes(id))) throw new Error('课程已被已发布任务引用，请先归档对应任务');
  return {...db,courses:db.courses.map(c=>c.id === id && c.tenantId === tenantId ? {...c,status:'archived'} : c)};
}
export function csvCell(value: unknown): string {
  const raw = String(value ?? '');
  const safe = /^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replaceAll('"','""') + '"';
}
