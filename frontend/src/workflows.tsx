import { randomId } from '../../shared/random-id.ts';
import { protectUnsaved } from "../../shared/navigation-guard";
import { KnowledgeDownload } from "./knowledge-download";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, FileText, Send } from "lucide-react";
import * as api from "@ola/learner-client";
import { Page, Topbar, FixedAction, Progress, Empty } from "./ui";
import { usePortal, useRemote, Loading, ErrorState } from "./portal";
import { percent, safeVideo } from "./domain";
const ClassroomSession = lazy(() =>
  import("@ola/classroom-ui/session").then((m) => ({
    default: m.ClassroomSession,
  })),
);
type Nav = { go: (path: string) => void; back: () => void };
export function StudyPage({
  id,
  version,
  go,
  back,
  lessonParameter,
}: Nav & { id: string; version: number; lessonParameter: string | null }) {
  const { data, refresh, notify } = usePortal(),
    remote = useRemote(() => api.course(id, version), [id, version]);
  const [index, setIndex] = useState(0),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [finished, setFinished] = useState(false);
  const events = useRef(new Map<string, string>());
  useEffect(() => {
    if (!remote.value) return;
    const first = remote.value.lessons.findIndex(
      (l) =>
        !data.progress.some(
          (p) =>
            p.courseId === id && p.version === version && p.lessonId === l.id,
        ),
    );
    setIndex(
      lessonParameter === null
        ? Math.max(0, first)
        : Math.max(
            0,
            Math.min(
              remote.value.lessons.length - 1,
              Number(lessonParameter) || 0,
            ),
          ),
    );
  }, [remote.value]);
  if (remote.error)
    return (
      <Page go={go}>
        <Topbar title="课程学习" back={back} />
        <ErrorState message={remote.error} retry={remote.retry} />
      </Page>
    );
  if (!remote.value) return <Loading />;
  const c = remote.value,
    l = c.lessons[index];
  if (c.kind !== "learn" || !l)
    return (
      <Page go={go}>
        <Topbar title="课程学习" back={back} />
        <Empty title="暂无学习内容" hint="请联系管理员完善课程" />
      </Page>
    );
  const complete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let event = events.current.get(l.id);
      if (!event) {
        event = randomId();
        events.current.set(l.id, event);
      }
      await api.complete(c, l.id, event);
      const saved = await refresh();
      notify("学习进度已保存");
      const missing = c.lessons.findIndex(
        (lesson) =>
          !saved.progress.some(
            (p) =>
              p.courseId === c.id &&
              p.version === c.version &&
              p.lessonId === lesson.id,
          ),
      );
      if (missing >= 0) {
        setReady(false);
        setIndex(missing);
        window.scrollTo(0, 0);
      } else setFinished(true);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page go={go} className="detail-page with-action">
      <Topbar
        title="课程学习"
        back={back}
        action={
          <span className="topbar-meta">
            {index + 1}/{c.lessons.length}
          </span>
        }
      />
      <div className="lesson-hero">
        <span>
          第 {index + 1} 章 · v{c.version}
        </span>
        <h1>{l.title}</h1>
        <p>{c.title}</p>
      </div>
      <main className="page-gutter lesson-body">
        {finished ? (
          <div className="info-card">
            <h2>课程学习完成</h2>
            <p>所有课时的学习记录已保存，可以继续下一阶段。</p>
            <button className="primary-button" onClick={() => go("/tasks")}>
              查看我的任务
            </button>
          </div>
        ) : (
          <section className="document-card mobile-study">
            {l.format === "AI课堂" ? (
              <Suspense fallback={<Loading />}>
                <ClassroomSession
                  key={l.id}
                  courseId={c.id}
                  version={c.version}
                  sceneId={l.content}
                  scene={c.classroom?.scenes.find(
                    (s: any) => s.id === l.content,
                  )}
                  onReadyChange={setReady}
                />
              </Suspense>
            ) : l.format === "视频链接" ? (
              safeVideo(l.content) ? (
                <video
                  key={l.id}
                  controls
                  preload="metadata"
                  src={safeVideo(l.content)!}
                />
              ) : (
                <ErrorState message="视频地址无效，请联系管理员" />
              )
            ) : (
              <>
                <div>
                  <FileText size={20} />
                  <strong>学习资料</strong>
                  <span>文档正文</span>
                </div>
                <div className="mobile-document">
                  {l.content
                    .split("\n")
                    .map((line, i) =>
                      line.startsWith("# ") ? (
                        <h2 key={i}>{line.slice(2)}</h2>
                      ) : line.startsWith("## ") ? (
                        <h3 key={i}>{line.slice(3)}</h3>
                      ) : (
                        <p key={i}>{line || "\u00a0"}</p>
                      ),
                    )}
                </div>
              </>
            )}
          </section>
        )}
        <div className="lesson-next">
          <strong>课程目录</strong>
          {c.lessons.map((lesson, i) => (
            <button
              key={lesson.id}
              className={i === index ? "selected" : ""}
              disabled={busy || (l.format === "AI课堂" && !ready)}
              onClick={() => {
                setReady(false);
                setFinished(false);
                setIndex(i);
              }}
            >
              <span>
                {i + 1}. {lesson.title}
              </span>
              {data.progress.some(
                (p) =>
                  p.courseId === c.id &&
                  p.version === c.version &&
                  p.lessonId === lesson.id,
              ) ? (
                <Check size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          ))}
        </div>
      </main>
      <FixedAction
        disabled={
          busy ||
          finished ||
          (l.format === "AI课堂" && !ready) ||
          (l.format === "视频链接" && !safeVideo(l.content))
        }
        onClick={() => void complete()}
      >
        {busy ? "正在保存…" : "完成本课时，继续"}
        <Check size={18} />
      </FixedAction>
    </Page>
  );
}

export function ExamRules({
  id,
  version,
  go,
  back,
}: Nav & { id: string; version: number }) {
  const { data, notify } = usePortal(),
    remote = useRemote(() => api.course(id, version), [id, version]);
  const [busy, setBusy] = useState(false);
  if (remote.error)
    return (
      <Page go={go}>
        <Topbar title="考试规则" back={back} />
        <ErrorState message={remote.error} retry={remote.retry} />
      </Page>
    );
  if (!remote.value) return <Loading />;
  const c = remote.value,
    used = data.attempts.filter(
      (a) => a.courseId === c.id && a.version === c.version,
    ).length;
  return (
    <Page go={go} className="detail-page with-action">
      <Topbar title="考试规则" back={back} />
      <div className="light-hero">
        <span className="eyebrow">考试课程 · 开始前请阅读</span>
        <h1>{c.title}</h1>
        <p>了解答题时间、题量与通过要求，准备好后即可开始。</p>
      </div>
      <main className="page-gutter rules-body">
        <div className="info-card">
          <h2>考试概览</h2>
          <div className="rule-grid">
            {[
              ["考试次数", c.examAttempts + " 次"],
              ["已开始次数", used + " 次"],
              ["考试总分", "100 分"],
              ["通过分数", c.examPass + " 分"],
              ["考试题数", (c.questionCount || 0) + " 题"],
              ["答题时长", c.examMinutes + " 分钟"],
            ].map(([title, value]) => (
              <div key={title}>
                <small>{title}</small>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="info-card">
          <h2>答题说明</h2>
          <p>
            答案自动保存，考试开始后持续计时，客观题由系统评分。离开不会暂停计时，再次进入可恢复未结束的答卷；主观题由管理员确认分数。
          </p>
        </div>
      </main>
      <FixedAction
        disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          try {
            const a = await api.startExam(c);
            go(`/exam/${a.id}`);
          } catch (e) {
            notify((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "正在准备试卷…" : "开始考试"}
        <ChevronRight size={18} />
      </FixedAction>
    </Page>
  );
}
export { ExamPage } from "./exam-page";
export {TrainingPage} from './training-page';
