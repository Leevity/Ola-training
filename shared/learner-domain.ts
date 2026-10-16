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
export function taskStatus(
  t: Task,
  data: Overview,
  today = new Date().toLocaleDateString("sv-SE"),
) {
  if (t.completedMemberIds.length || taskPercent(t, data) === 100)
    return "已完成";
  if (today < t.start) return "未开始";
  if (today > t.due) return "已到期";
  return taskPercent(t, data) > 0 ? "进行中" : "待完成";
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
