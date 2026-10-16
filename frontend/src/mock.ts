export type CourseKind = 'learn' | 'train' | 'exam';
export type Course = {
  id: string;
  title: string;
  kind: CourseKind;
  cover: string;
  summary: string;
  duration: string;
  count: number;
  progress: number;
  category: string;
  subtype?: 'human' | 'follow' | 'speech';
  badge?: string;
};

export const asset = (name: string) => `/assets/${name}`;

export const courses: Course[] = [
  { id: 'learn-1', title: '新客接待与需求识别', kind: 'learn', cover: asset('course-prompting.webp'), summary: '从接待开场到需求确认，掌握清晰的服务节奏', duration: '20 分钟', count: 4, progress: 50, category: '客户服务', badge: '学习中' },
  { id: 'learn-2', title: '家庭宽带异议处理', kind: 'learn', cover: asset('course-analysis.webp'), summary: '理解客户顾虑，建立有效的沟通方式', duration: '25 分钟', count: 3, progress: 0, category: '营销拓展' },
  { id: 'learn-3', title: '5G 套餐产品演练', kind: 'learn', cover: asset('course-communication.webp'), summary: '熟悉产品权益，介绍适合客户的方案', duration: '18 分钟', count: 3, progress: 60, category: '业务办理', badge: '学习中' },
  { id: 'learn-4', title: '服务礼仪与开场表达', kind: 'learn', cover: asset('follow-read-cover.jpg'), summary: '用专业、亲切的表达建立第一印象', duration: '16 分钟', count: 3, progress: 100, category: '综合素养', badge: '已完成' },
  { id: 'train-1', title: '新客接待模拟训练', kind: 'train', cover: asset('ai-training-cover.jpg'), summary: '与 AI 客户对练，练习需求探询和回应', duration: '12 分钟', count: 5, progress: 40, category: '客户服务', subtype: 'human', badge: '训练中' },
  { id: 'train-2', title: '产品介绍情景模拟训练', kind: 'train', cover: asset('course-analysis.webp'), summary: '在真实业务场景中清晰表达产品卖点', duration: '15 分钟', count: 8, progress: 0, category: '营销拓展', subtype: 'human' },
  { id: 'train-3', title: '服务礼仪与开场表达', kind: 'train', cover: asset('follow-read-cover.jpg'), summary: '逐轮听读，掌握自然的服务语气', duration: '8 分钟', count: 3, progress: 100, category: '综合素养', subtype: 'follow', badge: '已完成' },
  { id: 'train-4', title: '客户异议处理模拟训练', kind: 'train', cover: asset('course-communication.webp'), summary: '多轮对话训练，提升现场应变能力', duration: '14 分钟', count: 6, progress: 0, category: '客户服务', subtype: 'human' },
  { id: 'train-6', title: '客户咨询标准话术跟读', kind: 'train', cover: asset('follow-read-cover.jpg'), summary: '听、读、说结合，练习自然清晰的服务表达', duration: '9 分钟', count: 4, progress: 0, category: '客户服务', subtype: 'follow', badge: '推荐' },
  { id: 'train-5', title: '业务汇报演讲训练', kind: 'train', cover: asset('course-prompting.webp'), summary: '用结构化表达讲清楚业务重点', duration: '10 分钟', count: 4, progress: 0, category: '业务办理', subtype: 'speech' },
  { id: 'train-7', title: '客户服务标准流程训练', kind: 'train', cover: asset('ai-training-cover.jpg'), summary: '完整练习服务开场、确认需求与结束语', duration: '11 分钟', count: 4, progress: 100, category: '客户服务', subtype: 'human', badge: '已完成' },
  { id: 'exam-1', title: '业务知识阶段测评', kind: 'exam', cover: asset('course-analysis.webp'), summary: '检验课程学习成果，完成岗位能力测评', duration: '30 分钟', count: 5, progress: 0, category: '客户服务' },
  { id: 'exam-2', title: '家庭宽带营销测评', kind: 'exam', cover: asset('course-communication.webp'), summary: '围绕产品介绍与客户需求完成测评', duration: '25 分钟', count: 8, progress: 0, category: '营销拓展' },
  { id: 'exam-3', title: '服务规范认证考试', kind: 'exam', cover: asset('course-prompting.webp'), summary: '复习服务规范，检验实践要点', duration: '20 分钟', count: 6, progress: 100, category: '综合素养', badge: '已完成' },
];

export type Task = { id: string; title: string; due: string; start: string; status: '进行中' | '待开始' | '已完成'; done: number; total: number; learn: number; train: number; exam: number; courseIds: string[] };
export const tasks: Task[] = [
  { id: 'task-1', title: '新员工岗位能力提升任务', start: '10月12日', due: '10月16日', status: '进行中', done: 2, total: 4, learn: 1, train: 2, exam: 1, courseIds: ['learn-4', 'train-3', 'train-1', 'exam-1'] },
  { id: 'task-2', title: '家庭宽带营销任务', start: '10月12日', due: '10月20日', status: '待开始', done: 0, total: 4, learn: 1, train: 2, exam: 1, courseIds: ['learn-2', 'train-2', 'train-4', 'exam-2'] },
  { id: 'task-3', title: '5G 产品认证任务', start: '10月18日', due: '10月31日', status: '待开始', done: 0, total: 3, learn: 1, train: 1, exam: 1, courseIds: ['learn-3', 'train-5', 'exam-1'] },
  { id: 'task-4', title: '服务规范阶段任务', start: '10月01日', due: '10月10日', status: '已完成', done: 4, total: 4, learn: 1, train: 2, exam: 1, courseIds: ['learn-4', 'train-3', 'train-7', 'exam-3'] },
];

export const apps = [
  { id: 'sales', name: '销冠话术', desc: '客户场景与实战话术', color: 'blue' },
  { id: 'faq', name: '常见问题', desc: '快速找到工作答案', color: 'green' },
  { id: 'product', name: '产品知识', desc: '产品资料与卖点', color: 'violet' },
  { id: 'policy', name: '业务政策', desc: '政策说明与办理要求', color: 'amber' },
  { id: 'service', name: '服务规范', desc: '标准服务流程', color: 'blue' },
  { id: 'cases', name: '岗位案例', desc: '场景经验与案例', color: 'green' },
];

export type Question = { type: '单选题' | '多选题' | '判断题' | '填空题' | '问答题'; title: string; options?: string[]; answer: string[] };
export const questions: Question[] = [
  { type: '单选题', title: '以下哪项最适合确认客户需求？', options: ['先介绍全部产品', '先询问使用场景', '直接推荐最低价'], answer: ['B'] },
  { type: '多选题', title: '推荐家庭套餐前，应了解哪些信息？', options: ['家庭成员人数', '常用上网场景', '可接受的预算', '客户手机壳颜色'], answer: ['A', 'B', 'C'] },
  { type: '判断题', title: '介绍产品前，可以先确认客户目前最在意的问题。', options: ['正确', '错误'], answer: ['A'] },
  { type: '填空题', title: '复述客户需求时，应确认使用场景和______。', answer: ['预算'] },
  { type: '问答题', title: '客户说价格偏高时，你会如何继续沟通？', answer: ['先理解顾虑，再结合需求解释价值。'] },
];

export const people = [
  { name: '王雨欣', team: '市场部', score: 24, avatar: asset('role-a.png') },
  { name: '李明轩', team: '产品部', score: 20, avatar: asset('role-b.png') },
  { name: '张雅琪', team: '人力资源部', score: 18, avatar: asset('role-a.png') },
  { name: '演示学员', team: '技术部', score: 16, avatar: asset('role-b.png') },
  { name: '陈思瑶', team: '运营部', score: 14, avatar: asset('role-a.png') },
  { name: '刘子墨', team: '销售部', score: 12, avatar: asset('role-b.png') },
];
