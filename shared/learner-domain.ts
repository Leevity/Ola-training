import type {
  Course,
  Overview,
  Task,
} from "../packages/learner-client/src/types.ts";
export const labels = { learn: "学习", train: "训练", exam: "考试" };
export const actions = {
  learn: "开始学习",
  train: "开始训练",
  exam: "开始考试",
};
export const key = (c: { id: string; version: number }) =>
  `${c.id}:${c.version}`;
export function examEntry(c:Pick<Course,'id'|'version'|'examAttempts'>,data:Overview){
 const attempts=data.attempts.filter(a=>a.courseId===c.id&&a.version===c.version).sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt));
 const active=attempts.find(a=>a.status==='active');
 const exhausted=!active&&attempts.length>=c.examAttempts;
 return {used:attempts.length,active,latest:attempts[0],exhausted,action:active?'继续考试':exhausted?'查看最近答卷':'开始考试'};
}
/** Version-bound activity must remain visible while manual assessment is pending. */
export function phaseActivity(c: {id:string;version:number;kind:Course['kind']},data:Overview){
  const href=`/course/${c.id}?v=${c.version}`;
  if(data.completed.includes(key(c)))return {status:'已完成',action:'查看课程',href};
  if(c.kind==='learn'){
    const count=new Set(data.progress.filter(p=>p.courseId===c.id&&p.version===c.version).map(p=>p.lessonId)).size;
    return {status:count?`${count} 个课时已完成，可继续学习`:'待开始',action:count?'继续学习':'开始学习',href:`/content/${c.id}?v=${c.version}`};
  }
  const records=c.kind==='train'?data.training:data.attempts;
  const record=records.filter(r=>r.courseId===c.id&&r.version===c.version).sort((a,b)=>Date.parse('createdAt'in b?b.createdAt:b.startedAt)-Date.parse('createdAt'in a?a.createdAt:a.startedAt))[0];
  if(!record)return {status:'待开始',action:actions[c.kind],href};
  if(record.status==='active')return {status:'进行中',action:c.kind==='train'?'继续训练':'继续考试',href:`/${c.kind==='train'?'training':'exam'}/${record.id}`};
  if(record.status==='pending_review')return {status:c.kind==='train'?'待评价':'待阅卷',action:c.kind==='train'?'查看训练记录':'查看答卷',href:`/${c.kind==='train'?'recap':'exam'}/${record.id}`};
  return {status:'未达标，可查看结果',action:'查看结果',href:`/${c.kind==='train'?'recap':'exam'}/${record.id}`};
}
export function courseEntry(c:Course,data:Overview){
 const activity=phaseActivity(c,data);
 if(data.completed.includes(key(c)))return activity;
 if(c.kind==='learn')return {...activity,href:`/content/${c.id}?v=${c.version}`};
 return activity.status==='待开始'?{...activity,action:`查看${labels[c.kind]}`} : activity;
}
export function firstIncompleteLesson(c:Course,data:Overview){
  const saved=new Set(data.progress.filter(p=>p.courseId===c.id&&p.version===c.version).map(p=>p.lessonId));
  return c.lessons.findIndex(lesson=>!saved.has(lesson.id));
}
export function percent(c: Course, data: Overview) {
  if (data.completed.includes(key(c))) return 100;
  if (c.kind !== "learn") return 0;
  const ids = new Set(
    data.progress
      .filter((p) => p.courseId === c.id && p.version === c.version)
      .map((p) => p.lessonId),
  );
  return c.lessons.length
    ? Math.round(
        (c.lessons.filter((l) => ids.has(l.id)).length / c.lessons.length) *
          100,
      )
    : 0;
}
export function taskPercent(t: Task, data: Overview) {
  return t.snapshot.length
    ? Math.round(
        (t.snapshot.filter((c) => data.completed.includes(key(c))).length /
          t.snapshot.length) *
          100,
      )
    : 0;
}
/** Explain activity without presenting partial lessons as a completed course. */
export function taskActivityHint(t:Task,data:Overview){
 const pending=t.snapshot.filter(c=>!data.completed.includes(key(c)));
 const candidates=t.sequential?pending.slice(0,1):pending;
 for(const c of candidates){
  const activity=phaseActivity(c,data);
  if(activity.status==='待评价')return '训练已提交，等待管理员评价';
  if(activity.status==='待阅卷')return '已交卷，等待管理员阅卷';
  if(c.kind==='learn'&&activity.status!=='待开始')return activity.status;
  if(activity.status==='进行中')return c.kind==='train'?'训练进行中，可继续练习':'考试进行中，可恢复答卷';
  if(activity.status.startsWith('未达标'))return '尚未达标，可查看结果后继续练习';
 }
 return '';
}
export function taskStatus(
  t: Task,
  data: Overview,
  today = new Date().toLocaleDateString("sv-SE"),
) {
  if (t.completedMemberIds.length || taskPercent(t, data) === 100)
    return "已完成";
  if (today < t.start) return "未开始";
  if (today > t.due) return "已到期";
  const activity=[...data.progress,...(data.attempts||[]),...(data.training||[])];
  const started=t.snapshot.some(course=>activity.some(record=>record.courseId===course.id&&record.version===course.version));
  return taskPercent(t, data) > 0 || started ? "进行中" : "待完成";
}
/** Both learner clients use the same truthful next-learning and summary rules. */
export function nextLearningCourse(data: Overview) {
  const available = data.courses.filter(
    (c) => c.kind === "learn" && percent(c, data) < 100,
  );
  const recent = (c: Course) =>
    Math.max(
      0,
      ...data.progress
        .filter((p) => p.courseId === c.id && p.version === c.version)
        .map((p) => Date.parse(p.completed_at) || 0),
    );
  return (
    available
      .filter((c) => percent(c, data) > 0)
      .sort((a, b) => recent(b) - recent(a))[0] || available[0]
  );
}
export function learningSummary(
  data: Overview,
  today = new Date().toLocaleDateString("sv-SE"),
) {
  const effective = data.tasks.filter(
    (t) => t.start <= today && t.due >= today,
  );
  const effectiveDone = effective.filter(
    (t) => taskStatus(t, data, today) === "已完成",
  ).length;
  return {
    completedVersions: new Set(data.completed).size,
    completedTasks: data.tasks.filter(
      (t) => taskStatus(t, data, today) === "已完成",
    ).length,
    pendingTasks: data.tasks.filter(
      (t) => taskStatus(t, data, today) !== "已完成",
    ).length,
    trainingCount: data.training.filter((t) => t.status !== "active").length,
    passedExams: data.attempts.filter(
      (a) => a.status === "graded" && a.passed === true,
    ).length,
    effectiveTasks: effective.length,
    effectiveDone,
    taskCompletion: effective.length
      ? Math.round((effectiveDone / effective.length) * 100)
      : 0,
  };
}
export function secondsLeft(expires: string, now = Date.now()) {
  return Math.max(0, Math.ceil((Date.parse(expires) - now) / 1000));
}
export function safeVideo(value: string) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
export const date = (v: string) =>
  new Date(v).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
export const dateTime = (v: string) =>
  new Date(v).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
