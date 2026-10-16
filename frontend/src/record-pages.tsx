import { useEffect,useRef,useState } from "react";
import {routeChoice,choiceRoute} from '../../shared/learner-navigation';
import {keepListScroll} from '../../shared/learner-list-scroll';
import { Bell, ChevronRight, Clock3, FileText, Trophy } from "lucide-react";
import * as api from "@ola/learner-client";
import { asset, CourseCard, displayCourse, Empty, Page, Topbar } from "./ui";
import { usePortal, useRemote, Loading, ErrorState } from "./portal";
import { percent, dateTime, key } from "./domain";
type Nav = { go: (path: string) => void; back: () => void };
export function Records({ go, back, mode }: Nav & { mode: string }) {
  const { data,session } = usePortal();
  useEffect(()=>keepListScroll(session.user.tenantId+':'+session.user.memberId),[]);
  const [type, setType] = useState(()=>routeChoice(location.hash,'type',['training','exam'],'training')),
    [status, setStatus] = useState(()=>routeChoice(location.hash,'status',['all','active','done'],'all'));
  const courses = data.courses.filter(
    (c) =>
      status === "all" ||
      (status === "done" ? percent(c, data) === 100 : percent(c, data) < 100),
  );
  const training = data.training.filter(
    (t) =>
      status === "all" ||
      (status === "active" ? t.status === "active" : t.status !== "active"),
  );
  const attempts = data.attempts.filter(
    (a) =>
      status === "all" ||
      (status === "active" ? a.status === "active" : a.status !== "active"),
  );
  return (
    <Page go={go} className="detail-page">
      <Topbar
        title={mode === "history" ? "训练与考试记录" : "我的学习"}
        back={back}
      />
      <div className="light-hero">
        <span className="eyebrow">每一次努力都有记录</span>
        <h1>
          {mode === "history" ? "回顾练习，继续成长" : "让所学成为你的能力"}
        </h1>
        <p>
          {mode === "history"
            ? "训练表达、考试成绩与复盘统一保存在这里。"
            : "查看课程进度，继续未完成的学习。"}
        </p>
      </div>
      {mode === "history" && (
        <div className="detail-tabs">
          {[
            ["training", "训练历史"],
            ["exam", "考试记录"],
          ].map(([id, title]) => (
            <button
              className={type === id ? "selected" : ""}
              key={id}
              onClick={() => {
                setType(id);
                setStatus("all");
                go(choiceRoute(location.hash,{type:id,status:'all'}));
              }}
            >
              {title}
            </button>
          ))}
        </div>
      )}
      <main className="page-gutter">
        <div className="history-filter">
          <div>
            <strong>{mode === "history" ? "记录状态" : "学习状态"}</strong>
          </div>
          <div>
            {(mode === "history"
              ? [
                  ["all", "全部"],
                  ["active", "进行中"],
                  ["done", "已提交"],
                ]
              : [
                  ["all", "全部"],
                  ["active", "未完成"],
                  ["done", "已完成"],
                ]
            ).map(([id, title]) => (
              <button
                key={id}
                className={status === id ? "selected" : ""}
                onClick={() => {setStatus(id);go(choiceRoute(location.hash,{status:id}));}}
              >
                {title}
              </button>
            ))}
          </div>
        </div>
        {mode === "history" ? (
          type === "training" ? (
            training.length ? (
              training.map((t) => (
                <button
                  className="history-row"
                  key={t.id}
                  onClick={() =>
                    go(
                      t.status === "active"
                        ? `/training/${t.id}`
                        : `/recap/${t.id}`,
                    )
                  }
                >
                  <span className="history-icon">
                    <Clock3 size={20} />
                  </span>
                  <span>
                    <strong>{t.title}</strong>
                    <small>
                      v{t.version} · {dateTime(t.createdAt)}
                    </small>
                  </span>
                  <b>
                    {["completed", "failed"].includes(t.status)
                      ? `${t.score ?? "—"} 分${t.status === "failed" ? " · 未达标" : ""}`
                      : t.status === "pending_review"
                        ? "待评价"
                        : "进行中"}
                  </b>
                  <ChevronRight size={16} />
                </button>
              ))
            ) : (
              <Empty title="暂无训练记录" hint="开始训练后会保存在这里" />
            )
          ) : attempts.length ? (
            attempts.map((a) => (
              <button
                className="history-row"
                key={a.id}
                onClick={() => go(`/exam/${a.id}`)}
              >
                <span className="history-icon">
                  <FileText size={20} />
                </span>
                <span>
                  <strong>{a.title}</strong>
                  <small>
                    v{a.version} · {dateTime(a.startedAt)}
                  </small>
                </span>
                <b>
                  {a.status === "active"
                    ? "考试中"
                    : a.status === "pending_review"
                      ? "待阅卷"
                      : `${a.score ?? "—"} 分`}
                </b>
                <ChevronRight size={16} />
              </button>
            ))
          ) : (
            <Empty title="暂无考试记录" hint="开始考试后会保存在这里" />
          )
        ) : courses.length ? (
          <div className="course-grid">
            {courses.map((c) => (
              <CourseCard
                key={key(c)}
                course={displayCourse(c, data)}
                onClick={() => go(`/course/${c.id}?v=${c.version}`)}
              />
            ))}
          </div>
        ) : (
          <Empty title="暂无符合条件的课程" hint="可切换状态查看其他课程" />
        )}
      </main>
    </Page>
  );
}
export function Messages({ go, back }: Nav) {
  const { data, refresh,session } = usePortal();
  const [busy, setBusy] = useState(false),[error,setError]=useState(''),
    [tab,setTab]=useState(()=>routeChoice(location.hash,'tab',['all','unread'],'all'));
  const mounted=useRef(true),pending=useRef(false),retry=useRef<{ids:string[];href?:string}>({ids:[]});
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>keepListScroll(session.user.tenantId+':'+session.user.memberId),[]);
  const list=data.notifications.filter(n=>tab==='all'||!n.read);
  const read = async (ids: string[], href?: string) => {
    if (pending.current) return;
    pending.current=true;
    setBusy(true);setError('');retry.current={ids:[...ids],href};
    try {
      await api.readNotices(ids);
      if(!mounted.current)return;
      await refresh();
      if (href&&mounted.current) go(href);
    } catch (e) {
      if(mounted.current)setError((e as Error).message);
    } finally {
      pending.current=false;
      if(mounted.current)setBusy(false);
    }
  };
  return (
    <Page go={go}>
      <Topbar
        title="站内消息"
        back={back}
        action={
          <button
            disabled={busy || !data.notifications.some((n) => !n.read)}
            className="text-action"
            onClick={() =>
              void read(
                data.notifications.filter((n) => !n.read).map((n) => n.id),
              )
            }
          >
            全部已读
          </button>
        }
      />
      <div className="detail-tabs">
        <button disabled={busy} className={tab==='all'?'selected':''} onClick={()=>{setTab('all');go(choiceRoute(location.hash,{tab:'all'}));}}>全部消息</button>
        <button disabled={busy} className={tab==='unread'?'selected':''} onClick={()=>{setTab('unread');go(choiceRoute(location.hash,{tab:'unread'}));}}>未读 {data.notifications.filter(n=>!n.read).length}</button>
      </div>
      {error&&<div className="page-gutter"><ErrorState message={error} retry={()=>void read(retry.current.ids,retry.current.href)}/></div>}
      <main className="page-gutter message-list">
        {list.length ? (
          list.map((n) => (
            <button
              disabled={busy}
              key={n.id}
              onClick={() => void read([n.id], n.href)}
            >
              <span className="message-icon">
                <Bell size={20} />
              </span>
              <span>
                <strong>
                  {n.title}
                  {!n.read && <i />}
                </strong>
                <p>{n.text}</p>
                <small>{dateTime(n.at)}</small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))
        ) : (
          <Empty title={tab==='unread'?'暂无未读消息':'暂无消息'} hint={tab==='unread'?'所有消息都已读完，可切换全部消息查看':'新的任务和成绩会在这里提示'} />
        )}
      </main>
    </Page>
  );
}
export function RankPage({ go, back }: Nav) {
  const remote = useRemote(api.leaderboard, []);
  const [department, setDepartment] = useState("全部组织");
  const members = remote.value?.items || [],
    list = members.filter(
      (m) => department === "全部组织" || m.department === department,
    ),
    me = members.find((m) => m.isMe);
  const podium = list.length >= 3 ? [list[1], list[0], list[2]] : [];
  return (
    <Page go={go} className="detail-page rank-page">
      <Topbar title="学习排行榜" back={back} />
      <div className="rank-subtitle">
        按累计完成任务、学习课时、通过考试依次排序
      </div>
      <div className="page-gutter rank-controls">
        <label className="mobile-form">
          组织范围
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            {["全部组织", ...new Set(members.map((m) => m.department))].map(
              (d) => (
                <option key={d}>{d}</option>
              ),
            )}
          </select>
        </label>
        <p className="muted">展示企业前 100 名；组织筛选作用于当前榜单。</p>
      </div>
      {remote.error ? (
        <ErrorState message={remote.error} retry={remote.retry} />
      ) : !remote.value ? (
        <Loading />
      ) : (
        <>
          {podium.length > 0 && (
            <div className="rank-podium">
              {podium.map((m, i) => (
                <div className={`podium-place place-${i}`} key={m.id}>
                  <Trophy className="podium-trophy" size={22} />
                  <img src={asset("default-avatar.webp")} alt="" />
                  <strong>{m.name}</strong>
                  <small>{m.department}</small>
                  <b>
                    {m.tasks}
                    <em> 项任务</em>
                  </b>
                  <span>企业第 {m.rank} 名</span>
                </div>
              ))}
            </div>
          )}
          {me && (
            <button className="my-rank" onClick={() => go("/my/history")}>
              <span>我的排名</span>
              <b>
                第 <strong>{me.rank}</strong> 名
              </b>
              <img src={asset("default-avatar.webp")} alt="" />
              <div>
                <strong>{me.name}</strong>
                <small>{me.department}</small>
              </div>
              <ChevronRight size={18} />
            </button>
          )}
          <div className="rank-list">
            {list.map((m) => (
              <div key={m.id}>
                <b>{m.rank}</b>
                <img src={asset("default-avatar.webp")} alt="" />
                <span>
                  <strong>
                    {m.name}
                    {m.isMe ? "（我）" : ""}
                  </strong>
                  <small>
                    {m.department} · {m.lessons} 课时 · {m.exams} 次通过考试
                  </small>
                </span>
                <b>{m.tasks} 项</b>
              </div>
            ))}
          </div>
          {!list.length && (
            <div className="page-gutter">
              <Empty
                title="暂无榜单记录"
                hint="完成学习和任务后可在这里查看成长排名"
              />
            </div>
          )}
        </>
      )}
    </Page>
  );
}
