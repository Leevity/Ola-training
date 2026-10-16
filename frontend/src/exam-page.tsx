import { ConfirmationDialog } from "./confirmation-dialog";
import { registerLeaveGuard } from "../../shared/navigation-guard";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, ChevronRight } from "lucide-react";
import * as api from "@ola/learner-client";
import type { Attempt } from "@ola/learner-client/types";
import { Page, Topbar, FixedAction, Progress } from "./ui";
import { usePortal, useRemote, Loading, ErrorState } from "./portal";
import { secondsLeft } from "./domain";

const labels = {
  single: "单选题",
  multiple: "多选题",
  boolean: "判断题",
  fill: "填空题",
  text: "问答题",
};
export function ExamPage({
  id,
  go,
  back,
}: {
  id: string;
  go: (path: string) => void;
  back: () => void;
}) {
  const { data, refresh } = usePortal();
  const summary = data.attempts.find((a) => a.id === id);
  const remote = useRemote(() => api.attempt(id), [id]);
  const [attempt, setAttempt] = useState<Attempt | null>(null),
    [answers, setAnswers] = useState<Attempt["answers"]>({}),
    [index, setIndex] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saveStatus, setSaveStatus] = useState("答案已同步"),
    [confirm, setConfirm] = useState(false),
    [cardOpen, setCardOpen] = useState(false),
    [showResults, setShowResults] = useState(false),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (
      summary?.status === "graded" &&
      remote.value?.status === "pending_review"
    )
      remote.retry();
  }, [summary?.status, summary?.score, remote.value?.status]);
  const writer = useRef<api.ExamAnswerWriter | null>(null),
    clockOffset = useRef(0),
    latest = useRef<Attempt["answers"]>({}),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    autoSent = useRef(false),
    dirty = useRef(false),
    active = useRef(false),
    submitting = useRef(false);
  useEffect(() => {
    if (!remote.value) return;
    const value = remote.value;
    writer.current = new api.ExamAnswerWriter(
      value.answersRevision,
      (snapshot, revision) => api.saveAnswers(id, snapshot, revision),
    );
    setAttempt(value);
    setAnswers(value.answers);
    latest.current = value.answers;
    dirty.current = false;
    active.current = value.status === "active";
    setError("");
    setSaveStatus("答案已同步");
    clockOffset.current = value.serverNow
      ? Date.parse(value.serverNow) - Date.now()
      : 0;
  }, [remote.value]);
  const persist = async (value: Attempt["answers"]) => {
    try {
      await writer.current!.save(value);
      if (JSON.stringify(latest.current) === JSON.stringify(value)) {
        dirty.current = false;
        setSaveStatus("答案已保存");
        setError("");
      }
    } catch (e) {
      setError((e as Error).message);
      setSaveStatus(
        writer.current?.locked ? "答卷有更新，请先重新加载" : "有未保存的答案",
      );
      throw e;
    }
  };
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    const before = (e: BeforeUnloadEvent) => {
      if (active.current && dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const hidden = () => {
      if (
        document.visibilityState === "hidden" &&
        active.current &&
        dirty.current
      ) {
        clearTimeout(timer.current);
        void persist(latest.current).catch(() => {});
      }
    };
    const removeGuard = registerLeaveGuard(() => {
      if (!active.current || !dirty.current) return true;
      clearTimeout(timer.current);
      void persist(latest.current).catch(() => {});
      return window.confirm(
        "还有未保存的考试答案。离开可能丢失当前更改，考试计时仍会继续。确认离开？",
      );
    });
    window.addEventListener("beforeunload", before);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      removeGuard();
      clearInterval(interval);
      clearTimeout(timer.current);
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("visibilitychange", hidden);
      if (active.current && dirty.current)
        void persist(latest.current).catch(() => {});
    };
  }, [id]);
  const update = (questionId: string, value: string[]) => {
    if (submitting.current || writer.current?.locked) return;
    const next = { ...latest.current, [questionId]: value };
    latest.current = next;
    dirty.current = true;
    setAnswers(next);
    setSaveStatus("正在保存…");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      void persist(next).catch(() => {});
    }, 400);
  };
  const submit = async (expired = false) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setConfirm(false);
    setError("");
    clearTimeout(timer.current);
    expired =
      expired ||
      (!!attempt &&
        secondsLeft(attempt.expiresAt, Date.now() + clockOffset.current) === 0);
    try {
      if (!expired) await persist(latest.current);
      else await writer.current?.drain().catch(() => {});
      const result = await api.submitExam(
        id,
        expired ? undefined : latest.current,
        writer.current?.revision,
      );
      active.current = false;
      dirty.current = false;
      setAttempt(result);
      setAnswers(result.answers);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  };
  const left = attempt
      ? secondsLeft(attempt.expiresAt, now + clockOffset.current)
      : 0,
    locked = writer.current?.locked || false;
  useEffect(() => {
    if (attempt?.status === "active" && left === 0 && !autoSent.current) {
      autoSent.current = true;
      void submit(true);
    }
  }, [attempt?.status, left]);
  if (remote.error)
    return (
      <Page go={go}>
        <Topbar title="考试" back={back} />
        <ErrorState message={remote.error} retry={remote.retry} />
      </Page>
    );
  if (!attempt) return <Loading />;
  const answered = attempt.paper.questions.filter((q) =>
    (answers[q.id] || []).some(Boolean),
  ).length;
  if (attempt.status !== "active")
    return (
      <Page go={go} className="detail-page with-action">
        <Topbar title="考试成绩" back={back} />
        <div
          className={`result-hero ${attempt.status === "pending_review" ? "pending" : attempt.passed ? "" : "failed"}`}
        >
          {attempt.status === "pending_review" ? (
            <Clock3 size={42} />
          ) : (
            <CheckCircle2 size={42} />
          )}
          <span>
            {attempt.status === "pending_review"
              ? "主观题待人工阅卷"
              : attempt.passed
                ? "考试合格"
                : "本次未合格"}
          </span>
          <b>
            {attempt.score ?? 0}
            <small>分</small>
          </b>
          <p>
            {attempt.status === "pending_review"
              ? "当前显示客观题得分，阅卷后更新最终成绩"
              : "本次成绩已保存"}
          </p>
        </div>
        <main className="page-gutter">
          <div className="info-card">
            <h2>成绩概览</h2>
            <div className="info-grid">
              <span>
                <small>作答题数</small>
                <b>
                  {answered}/{attempt.paper.questions.length}
                </b>
              </span>
              <span>
                <small>合格分数</small>
                <b>{attempt.paper.passScore} 分</b>
              </span>
              <span>
                <small>当前状态</small>
                <b>
                  {attempt.status === "pending_review"
                    ? "待阅卷"
                    : attempt.passed
                      ? "已合格"
                      : "未合格"}
                </b>
              </span>
            </div>
          </div>
          <div className="section-title">
            <h2>作答回顾</h2>
            <button onClick={() => setShowResults((v) => !v)}>
              {showResults ? "收起" : "查看全部"}
              <ChevronRight size={16} />
            </button>
          </div>
          {showResults &&
            attempt.paper.questions.map((q, i) => (
              <div className="analysis-row" key={q.id}>
                <strong>
                  {i + 1}. {q.title}
                </strong>
                <p>
                  我的答案：
                  {(answers[q.id] || [])
                    .map(
                      (value) =>
                        q.options.find((o) => o.id === value)?.text || value,
                    )
                    .join("、") || "未作答"}
                </p>
                <small>
                  {labels[q.type]} · {q.points} 分
                </small>
              </div>
            ))}
        </main>
        <FixedAction
          onClick={() => go(attempt.passed ? "/tasks?status=done" : "/tasks")}
        >
          返回任务
          <ChevronRight size={18} />
        </FixedAction>
      </Page>
    );
  const q = attempt.paper.questions[index];
  if (!q) return <ErrorState message="试卷暂不可用" />;
  const selected = answers[q.id] || [];
  return (
    <Page go={go} className="detail-page with-action quiz-page">
      <Topbar
        title="考试作答"
        back={back}
        action={
          <button className="text-action" onClick={() => setCardOpen(true)}>
            答题卡
          </button>
        }
      />
      <div className="quiz-progress">
        <div>
          <span>
            已完成 <b>{answered}</b>/{attempt.paper.questions.length} 题
          </span>
          <span>
            剩余{" "}
            <b>
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
            </b>
          </span>
        </div>
        <small>{saveStatus}</small>
        <Progress value={(answered / attempt.paper.questions.length) * 100} />
      </div>
      {error && (
        <div className="page-gutter">
          <ErrorState message={error} />
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => {
              if (locked) {
                clearTimeout(timer.current);
                void writer.current
                  ?.drain()
                  .catch(() => {})
                  .then(() => remote.retry());
              } else if (left === 0) void submit(true);
              else void persist(latest.current).catch(() => {});
            }}
          >
            {locked
              ? "放弃本地更改并加载服务端答卷"
              : left === 0
                ? "提交已保存的答案"
                : "重试保存"}
          </button>
        </div>
      )}
      <main className="page-gutter">
        <section className="quiz-card">
          <div className="quiz-card-top">
            <strong>
              第 {index + 1}/{attempt.paper.questions.length} 题
            </strong>
            <button onClick={() => setCardOpen(true)}>查看答题卡</button>
          </div>
          <div className="question-body">
            <span className="question-type">
              {labels[q.type]} · {q.points} 分
            </span>
            <h1>{q.title}</h1>
            <fieldset
              disabled={busy || left === 0 || locked}
              className="answer-options native-answer-options"
            >
              {["single", "multiple", "boolean"].includes(q.type) ? (
                q.options.map((option) => (
                  <label
                    key={option.id}
                    className={selected.includes(option.id) ? "selected" : ""}
                  >
                    <span>{option.id}</span>
                    <strong>{option.text}</strong>
                    <input
                      aria-label={option.id + " · " + option.text}
                      type={q.type === "multiple" ? "checkbox" : "radio"}
                      name={q.id}
                      checked={selected.includes(option.id)}
                      onChange={(e) =>
                        update(
                          q.id,
                          q.type === "multiple"
                            ? e.target.checked
                              ? [...selected, option.id]
                              : selected.filter((v) => v !== option.id)
                            : [option.id],
                        )
                      }
                    />
                  </label>
                ))
              ) : (
                <textarea
                  aria-label="题目答案"
                  rows={q.type === "text" ? 6 : 2}
                  maxLength={10000}
                  value={selected[0] || ""}
                  onChange={(e) => update(q.id, [e.target.value])}
                />
              )}
            </fieldset>
            <p>
              {q.type === "multiple"
                ? "请选择所有符合要求的选项"
                : q.type === "single" || q.type === "boolean"
                  ? "请选择一个答案"
                  : "请填写你的答案"}
            </p>
          </div>
        </section>
      </main>
      <footer className="quiz-footer">
        <button disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          上一题
        </button>
        <button
          className="primary-button"
          disabled={busy || (locked && left > 0)}
          onClick={() =>
            index === attempt.paper.questions.length - 1
              ? setConfirm(true)
              : setIndex((i) => i + 1)
          }
        >
          {busy
            ? "正在提交…"
            : index === attempt.paper.questions.length - 1
              ? "提交试卷"
              : "下一题"}
        </button>
      </footer>
      {cardOpen && (
        <ConfirmationDialog title="答题卡" onClose={() => setCardOpen(false)}>
          <div className="sheet-head">
            <h2>答题卡</h2>
            <button className="text-action" onClick={() => setCardOpen(false)}>
              关闭
            </button>
          </div>
          <p>
            已完成 {answered}/{attempt.paper.questions.length} 题
          </p>
          <div className="answer-grid">
            {attempt.paper.questions.map((q, i) => (
              <button
                className={`${i === index ? "current" : ""} ${(answers[q.id] || []).some(Boolean) ? "done" : ""}`}
                key={q.id}
                onClick={() => {
                  setIndex(i);
                  setCardOpen(false);
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </ConfirmationDialog>
      )}
      {confirm && (
        <ConfirmationDialog title="确认交卷" onClose={() => setConfirm(false)}>
          <h2>确认提交试卷？</h2>
          <p>
            已回答 {answered}/{attempt.paper.questions.length}{" "}
            题。提交后不能继续作答。
          </p>
          <div className="mobile-tabs">
            <button onClick={() => setConfirm(false)}>继续作答</button>
            <button className="primary-button" onClick={() => void submit()}>
              确认交卷
            </button>
          </div>
        </ConfirmationDialog>
      )}
    </Page>
  );
}
