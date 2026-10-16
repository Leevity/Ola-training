import { randomId } from '../../../shared/random-id.ts';
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as api from "@ola/learner-client";
import type { Chat, Overview, Source, User } from "@ola/learner-client/types";
import { percent, courseEntry } from "../../../shared/learner-domain.ts";

type Icons = {
  history: ReactNode;
  chat: ReactNode;
  document: ReactNode;
  camera: ReactNode;
  mic: ReactNode;
  send: ReactNode;
  arrow: ReactNode;
  close: ReactNode;
};
const apps = [
  { id: "terminal", label: "超级助手" },
  { id: "sales", label: "销冠话术" },
  { id: "faq", label: "常见问题" },
];
const otherApps: Record<string, string> = {
  product: "产品知识",
  policy: "业务政策",
  service: "服务规范",
  cases: "岗位案例",
};
type History = Awaited<ReturnType<typeof api.sessions>>["items"];
export function LearnerAssistant({
  data,
  user,
  go,
  notify,
  icons,
  sessionId,
  initialApp = "terminal",
  desktop = false,
}: {
  data: Overview;
  user: User;
  go: (path: string) => void;
  notify: (message: string) => void;
  icons: Icons;
  sessionId?: string;
  initialApp?: string;
  desktop?: boolean;
}) {
  const [chat, setChat] = useState<Chat | null>(null),
    [history, setHistory] = useState<History>([]),
    [historyOpen, setHistoryOpen] = useState(false),
    [historyError, setHistoryError] = useState(""),
    [error, setError] = useState(""),
    [input, setInput] = useState(
      () => new URLSearchParams(location.hash.split("?")[1]).get("q") || "",
    ),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(Boolean(sessionId)),
    [revision, setRevision] = useState(0);
  const messageId = useRef(randomId()),
    end = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    alive = useRef(true),
    pending = useRef(false);
  const mode = chat?.session.app || initialApp;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(Boolean(sessionId));
    setError("");
    setChat(null);
    if (sessionId)
      api
        .chat(sessionId)
        .then((c) => {
          if (active) setChat(c);
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    return () => {
      active = false;
    };
  }, [sessionId, revision]);
  useEffect(() => {
    let active = true;
    api
      .sessions()
      .then((r) => {
        if (active) {
          setHistory(r.items);
          setHistoryError("");
        }
      })
      .catch((e) => {
        if (active) setHistoryError(e.message);
      });
    return () => {
      active = false;
    };
  }, [chat?.messages.length, revision]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [chat?.messages.length, loading]);
  useEffect(() => {
    if (!historyOpen) return;
    const d = dialog.current!,
      previous = document.activeElement as HTMLElement | null;
    d.showModal();
    return () => {
      d.close();
      previous?.isConnected && previous.focus();
    };
  }, [historyOpen]);
  const send = async () => {
    if (pending.current || !input.trim()) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      let current = chat;
      if (!current) {
        const s = await api.createChat(mode, input.trim().slice(0, 80));
        current = {
          session: { id: s.id, app: mode, title: input.trim().slice(0, 80) },
          messages: [],
        };
        if (alive.current) setChat(current);
      }
      await api.sendChat(current.session.id, input.trim(), messageId.current);
      const updated = await api.chat(current.session.id);
      if (alive.current) {
        setChat(updated);
        setInput("");
        messageId.current = randomId();
        if (!sessionId) go("/chat/" + current.session.id);
      }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const open = (id: string) => {
    setHistoryOpen(false);
    go("/chat/" + id);
  };
  const list = (
    <>
      {historyError ? (
        <div className="assistant-error" role="alert">
          {historyError}
          <button onClick={() => setRevision((v) => v + 1)}>重试</button>
        </div>
      ) : history.length ? (
        history.map((s) => (
          <button
            className={s.id === sessionId ? "selected" : ""}
            key={s.id}
            onClick={() => open(s.id)}
          >
            <strong>{s.title}</strong>
            <small>
              {new Date(s.created_at).toLocaleString("zh-CN", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
          </button>
        ))
      ) : (
        <p className="assistant-history-empty">暂无历史，发送问题开始对话。</p>
      )}
    </>
  );
  const courseCard = (source: Source) => {
    const c = data.courses.find(
        (c) => c.id === source.id && c.version === source.version,
      ),
      progress = c ? percent(c, data) : (source.progress ?? 0);
    const entry=c?courseEntry(c,data):{action:'查看课程',href:`/course/${source.id}?v=${source.version||1}`,status:progress===100?'已完成课程':'查看课程信息'};
    return (
      <button
        className="assistant-course"
        key={source.id + ":" + source.version}
        onClick={() => go(entry.href)}
      >
        <img
          src={c?.cover || source.cover || "/assets/course-communication.webp"}
          alt=""
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/assets/course-communication.webp";
          }}
        />
        <span className="assistant-course-copy">
          <strong>{source.title}</strong>
          <small>
            {c?.kind!=='learn'?entry.status:progress === 100
              ? "已完成学习"
              : progress
                ? "继续上次学习"
                : "尚未开始学习"}
          </small>
          <span className="assistant-course-progress">
            <i>
              <b style={{ width: progress + "%" }} />
            </i>
            <em>{progress}%</em>
          </span>
        </span>
        <span className="assistant-course-action">
          {entry.action}
          {icons.arrow}
        </span>
      </button>
    );
  };
  return (
    <div
      className={`learner-assistant ${desktop ? "assistant-desktop" : "assistant-handheld"}`}
    >
      {desktop && (
        <aside className="assistant-history-sidebar">
          <div>
            <h2>对话记录</h2>
            <button disabled={busy} onClick={() => go("/whale")}>
              新对话
            </button>
          </div>
          {list}
        </aside>
      )}
      <section className="assistant-conversation" aria-label="ola对话">
        <header className="assistant-header">
          <img
            className="assistant-header-decoration"
            src="/assets/whale-header-decoration.png"
            alt=""
          />
          <img src="/assets/ola-app-icon.png" alt="ola" />
          <div>
            <h1>ola</h1>
            <p>学习与工作，一问就知道</p>
          </div>
          {!desktop&&<button onClick={() => setHistoryOpen(true)}>
            {icons.history}
            <span>历史</span>
          </button>}
        </header>
        <nav className="assistant-app-tabs" aria-label="知识应用">
          {[
            ...apps,
            ...(otherApps[mode] ? [{ id: mode, label: otherApps[mode] }] : []),
          ].map((app) => (
            <button
              disabled={busy}
              key={app.id}
              className={mode === app.id ? "selected" : ""}
              aria-pressed={mode === app.id}
              onClick={() => go("/whale?app=" + app.id)}
            >
              {app.id === "terminal" ? (
                <img src="/assets/ola-app-icon.png" alt="" />
              ) : app.id === "faq" ? (
                icons.document
              ) : (
                icons.chat
              )}
              {app.label}
            </button>
          ))}
        </nav>
        <div className="assistant-messages" aria-live="polite">
          {loading ? (
            <p className="assistant-state" role="status">
              正在加载对话…
            </p>
          ) : !chat?.messages.length && !error ? (
            <div className="assistant-welcome">
              <img src="/assets/ola-app-icon.png" alt="" />
              <h2>有什么可以帮你？</h2>
              <p>
                {mode === "terminal"
                  ? "查课程、看学习进度，也可以检索企业知识。"
                  : `在${apps.find((a) => a.id === mode)?.label || otherApps[mode] || "企业知识"}中查找工作资料。`}
              </p>
              <div>
                {(mode === "terminal"
                  ? ["我有哪些课程没完成？", "查找客户服务课程"]
                  : mode === "sales"
                    ? ["查找客户沟通话术", "查找需求识别资料"]
                    : ["查找业务办理常见问题", "查找产品资料"]
                ).map((q) => (
                  <button key={q} onClick={() => setInput(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {chat?.messages.map((m) => {
            const courses = m.result.sources.filter((s) => s.type === "course"),
              knowledge = m.result.sources.filter(
                (s) => s.type === "knowledge",
              );
            return (
              <article className="assistant-exchange" key={m.id}>
                <time>
                  {new Date(m.created_at).toLocaleString("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                <div className="assistant-user-row">
                  <p>{m.text}</p>
                  <img src="/assets/default-avatar.png" alt={user.name} />
                </div>
                <div className="assistant-answer-row">
                  <img src="/assets/ola-app-icon.png" alt="ola" />
                  <div className="assistant-answer-body">
                    <p className="assistant-answer-bubble">
                      {m.result.message}
                    </p>
                    {courses.length > 0 && (
                      <section className="assistant-result-card">
                        <header>
                          <h2>
                            {m.result.mode === "learning"
                              ? "学习课程"
                              : "相关课程"}
                          </h2>
                          <button onClick={() => go("/courses")}>
                            查看全部{icons.arrow}
                          </button>
                        </header>
                        {courses.map(courseCard)}
                      </section>
                    )}
                    {knowledge.map((s) => (
                      <section
                        className="assistant-result-card assistant-knowledge"
                        key={s.id}
                      >
                        <header>
                          <h2>{s.title}</h2>
                        </header>
                        <p>{s.excerpt}</p>
                        <p className="assistant-reference">
                          知识原文引用，请结合业务要求核对。
                        </p>
                        <button
                          className="assistant-link"
                          onClick={() =>
                            void api
                              .downloadKnowledge(s.id)
                              .then((r) => api.triggerBrowserDownload(r))
                              .catch((e) => notify(e.message))
                          }
                        >
                          下载原文{icons.arrow}
                        </button>
                      </section>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
          {busy && (
            <p className="assistant-state" role="status">
              正在查找相关内容…
            </p>
          )}
          {error && (
            <div className="assistant-error" role="alert">
              <p>{error}</p>
              {sessionId && !chat ? (
                <button onClick={() => setRevision((v) => v + 1)}>
                  重新加载
                </button>
              ) : (
                <button disabled={busy} onClick={() => void send()}>
                  重试发送
                </button>
              )}
            </div>
          )}
          <div ref={end} />
        </div>
        <form
          className="assistant-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <div>
            <button
              type="button"
              aria-label="图片提问暂未开放"
              title="图片提问暂未开放，请使用文字输入"
              disabled
            >
              {icons.camera}
            </button>
            <input
              disabled={loading || busy}
              aria-label="有问题尽管问我"
              placeholder="有问题尽管问我…"
              maxLength={2000}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                messageId.current = randomId();
              }}
            />
            {input.trim() ? (
              <button
                disabled={busy || loading}
                className="assistant-send"
                aria-label="发送问题"
              >
                {icons.send}
              </button>
            ) : (
              <button
                type="button"
                className="assistant-mic"
                aria-label="语音输入暂未开放"
                title="语音输入暂未开放，请使用文字输入"
                disabled
              >
                {icons.mic}
              </button>
            )}
          </div>
        </form>
      </section>
      {historyOpen && (
        <dialog
          ref={dialog}
          className="assistant-history-dialog"
          aria-label="对话历史"
          onCancel={() => setHistoryOpen(false)}
        >
          <header>
            <h2>对话历史</h2>
            <button aria-label="关闭历史" onClick={() => setHistoryOpen(false)}>
              {icons.close}
            </button>
          </header>
          {list}
        </dialog>
      )}
    </div>
  );
}
