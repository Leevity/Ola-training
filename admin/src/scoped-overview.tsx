import { ArrowRight, BookOpen, FolderOpen, ListChecks, Users } from 'lucide-react';
import type { Course, Knowledge, Member, Task } from './domain';
import { Empty, PageTitle } from './ui';

export function ScopedOverview({content, department, courses, tasks, members, knowledge, go}: {
  content: boolean; department: string; courses: Course[]; tasks: Task[];
  members: Member[]; knowledge: Knowledge[]; go: (route: string) => void;
}) {
  const items = content ? [
    {label: '课程内容', value: courses.filter(c => c.status !== 'archived').length, note: '维护学习、训练与考试内容', icon: BookOpen, to: 'courses'},
    {label: '知识文件', value: knowledge.filter(k => k.status !== 'archived').length, note: '上传资料、解析正文与配置使用范围', icon: FolderOpen, to: 'knowledge'},
  ] : [
    {label: '部门任务', value: tasks.length, note: '查看分配给本部门的任务', icon: ListChecks, to: 'tasks'},
    {label: '部门成员', value: members.length, note: '查看本部门成员信息', icon: Users, to: 'members'},
  ];
  return <>
    <PageTitle eyebrow="管理中心" title="工作台" description={content ? '维护课程与知识资料，准备可供任务使用的培训内容。' : `查看${department}的任务、成员与学习报告。`}/>
    <div className="notice inline-notice"><BookOpen size={18}/><span>{content ? '当前角色：内容作者。任务分配、成员管理与企业设置由企业管理员维护。' : '当前角色：部门管理员。可查看课程与本部门任务、成员和报告；内容维护、任务分配及阅卷由企业管理员处理。'}</span></div>
    <div className="stats-row scoped-stats">{items.map(({label, value, note, icon: Icon, to}) => <button key={to} className="stat" onClick={() => go(to)}><div><span>{label}</span><Icon size={20}/></div><strong>{value}</strong><p>{note}<ArrowRight size={15}/></p></button>)}</div>
    <section className="surface"><div className="section-heading"><div><h2>{content ? '继续内容建设' : '查看部门培训'}</h2><p>{content ? '从课程与知识文件继续工作' : '任务与报告仅包含当前部门可见成员'}</p></div></div><div className="quick-actions">{items.map(({label, note, to, icon: Icon}) => <button key={to} onClick={() => go(to)}><span><Icon size={20}/></span><div><strong>{label}</strong><small>{note}</small></div><ArrowRight size={16}/></button>)}</div>{!content && <button className="button" onClick={() => go('reports')}>查看学习报告 <ArrowRight size={16}/></button>}{content && !courses.length && <Empty title="尚未创建课程" hint="可以先上传知识资料，再到课程管理创建培训内容。" action="管理课程" onAction={() => go('courses')}/>}</section>
  </>;
}
