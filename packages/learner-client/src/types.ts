export type { Course, Task, Kind } from '../../../shared/domain.ts';
import type { Course, Task } from '../../../shared/domain.ts';
export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  memberId: string;
  department: string;
  platformAdmin: boolean;
};
export type Tenant = { id: string; name: string; shortName: string };
export type Progress = { courseId: string; version: number; lessonId: string; completed_at: string };
export type AttemptSummary = {
  id: string;
  courseId: string;
  version: number;
  title: string;
  status: string;
  score: number | null;
  passed: boolean | null;
  startedAt: string;
  expiresAt: string;
};
export type TrainingSummary = {
  id: string;
  courseId: string;
  version: number;
  title: string;
  status: string;
  score: number | null;
  createdAt: string;
  evaluation?: { feedback: string; passed: boolean } | null;
};
export type Notice = { id: string; title: string; text: string; at: string; href: string; read: boolean };
export type Review = { courseId: string; version: number; rating: number; comment: string };
export type Overview = {
  courses: Course[];
  tasks: Task[];
  completed: string[];
  progress: Progress[];
  attempts: AttemptSummary[];
  training: TrainingSummary[];
  favorites: string[];
  reviews: Review[];
  notifications: Notice[];
};
export type Question = {
  id: string;
  type: 'single' | 'multiple' | 'boolean' | 'fill' | 'text';
  title: string;
  points: number;
  options: { id: string; text: string }[];
};
export type Attempt = {
  answersRevision: number;
  serverNow?: string;
  id: string;
  courseId: string;
  version: number;
  status: string;
  score: number | null;
  passed: boolean | null;
  answers: Record<string, string[]>;
  startedAt: string;
  expiresAt: string;
  paper: { questions: Question[]; passScore: number };
};
export type Training = {
  course?: {id:string;title:string;version:number;role?:string;objective?:string;rubric?:string;trainingMode?:string};
  session: {
    id: string;
    course_id: string;
    course_version: number;
    status: string;
    score: number | null;
    evaluation: { feedback: string; passed: boolean } | null;
    created_at: string;
  };
  messages: { id: string; text: string; created_at: string }[];
};
export type Source = {
  type: 'course' | 'knowledge';
  id: string;
  title: string;
  excerpt: string;
  version?: number;
  cover?: string;
  progress?: number;
};
export type AssistantResult = { mode: string; message: string; sources: Source[]; total?: number };
export type Chat = {
  session: { id: string; app: string; title: string };
  messages: { id: string; text: string; result: AssistantResult; created_at: string }[];
};
