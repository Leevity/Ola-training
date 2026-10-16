import { KnowledgeDownload } from "./knowledge-download";
import {routeChoice,choiceRoute} from '../../shared/learner-navigation';
import { useEffect,useState } from "react";
import {
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Search,
  Star,
  UserRound,
} from "lucide-react";
import * as api from "@ola/learner-client";
import type { Course, Task } from "@ola/learner-client/types";
import {
  asset,
  CourseCard,
  courseImageFallback,
  displayCourse,
  Empty,
  FixedAction,
  Page,
  Progress,
  SectionTitle,
  Topbar,
  type MainTab,
} from "./ui";
import { usePortal, useRemote, Loading, ErrorState } from "./portal";
import { percent, taskPercent, taskStatus, labels, dateTime, examEntry } from "./domain";
type Nav = { go: (path: string) => void; back: () => void };
export function CourseDetail({
  id,
  version,
  go,
  back,
}: Nav & { id: string; version: number }) {
  const { data, refresh, notify } = usePortal(),
    remote = useRemote(() => api.course(id, version), [id, version]);
  const [tab, setTab] = useState(()=>routeChoice(location.hash,'tab',['目录','简介','评价'],'目录')),
    [busy, setBusy] = useState(false);
  useEffect(()=>setTab(routeChoice(location.hash,'tab',['目录','简介','评价'],'目录')),[location.hash]);
  if (remote.error)
    return (
      <Page go={go}>
        <Topbar title="课程详情" back={back} />
        <ErrorState message={remote.error} retry={remote.retry} />
      </Page>
    );
  if (!remote.value) return <Loading />;
  const c = remote.value;
  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (c.kind === "learn") go(`/content/${c.id}?v=${c.version}`);
      else if (c.kind === "exam") go(`/exam/rules/${c.id}?v=${c.version}`);
      else {
        const result = await api.startTraining(c);
        go(`/training/${result.id}`);
      }
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page go={go} className="detail-page with-action">
      <Topbar
        title={`${labels[c.kind]}课程详情`}
        back={back}
        action={
          <button
            className="icon-button"
            aria-label={data.favorites.includes(c.id) ? "取消收藏" : "收藏课程"}
            aria-pressed={data.favorites.includes(c.id)}
            onClick={() =>
              void api
                .favorite(c.id, !data.favorites.includes(c.id))
                .then(refresh)
                .catch((e) => notify(e.message))
            }
          >
            <Star
              size={19}
              fill={data.favorites.includes(c.id) ? "currentColor" : "none"}
            />
          </button>
        }
      />
      <div className="course-detail-head">
        <div className="course-detail-cover">
          <img
            className="cover-back"
            src={c.cover}
            alt=""
            onError={courseImageFallback}
          />
          <img
            className="cover-front"
            src={c.cover}
            alt=""
            onError={courseImageFallback}
          />
          <span>
            {labels[c.kind]}课程 · v{c.version}
          </span>
        </div>
        <div className="course-detail-heading">
          <h1>{c.title}</h1>
          <p>{c.summary}</p>
          <div>
            <span>
              <Clock3 size={15} />
              {c.kind === "exam" ? c.examMinutes : c.duration} 分钟
            </span>
            <span>
              <FileText size={15} />
              {c.category}
            </span>
          </div>
        </div>
      </div>
      {c.kind === "exam" ? (
        <main className="page-gutter">
          <div className="info-card">
            <h2>考试概览</h2>
            <div className="info-grid">
              <span>
                <small>答题时长</small>
                <b>{c.examMinutes} 分钟</b>
              </span>
              <span>
                <small>题目数量</small>
                <b>{c.questionCount || 0} 题</b>
              </span>
              <span>
                <small>通过分数</small>
                <b>{c.examPass} 分</b>
              </span>
            </div>
          </div>
          <div className="text-section">
            <h2>测评说明</h2>
            <p>
              最多允许 {c.examAttempts}{" "}
              次考试。主观题由管理员确认分数，阅卷后显示正式成绩。
            </p>
          </div>
        </main>
      ) : (
        <>
          <div className="detail-tabs">
            {["目录", "简介", "评价"].map((t) => (
              <button
                key={t}
                className={t === tab ? "selected" : ""}
                onClick={() => {setTab(t);go(choiceRoute(location.hash,{tab:t}));}}
              >
                {t}
              </button>
            ))}
          </div>
          <main className="page-gutter detail-tab-body">
            {tab === "目录" ? (
              c.kind === "learn" ? (
                <div className="chapter-list">
                  {c.lessons.map((l, index) => (
                    <button
                      key={l.id}
                      onClick={() =>
                        go(`/content/${c.id}?v=${c.version}&lesson=${index}`)
                      }
                    >
                      <span className="chapter-icon">
                        <BookOpen size={18} />
                      </span>
                      <span>
                        <strong>
                          第 {index + 1} 章 · {l.title}
                        </strong>
                        <small>{l.format}</small>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="info-card">
                  <h3>{c.kind === "train" ? "训练目标" : "考试规则"}</h3>
                  <p>
                    {c.kind === "train"
                      ? c.objective
                      : `${c.examMinutes}分钟，${c.examPass}分合格，最多${c.examAttempts}次`}
                  </p>
                  {c.kind === "train" && <p>评价标准：{c.rubric}</p>}
                </div>
              )
            ) : tab === "简介" ? (
              <div className="text-section">
                <h3>课程简介</h3>
                <p>{c.summary}</p>
                {c.knowledgeIds.map((k) => (
                  <KnowledgeDownload
                    key={k}
                    id={k}
                    course={{ courseId: c.id, version: c.version }}
                    className="mobile-list-row"
                    label="下载关联资料"
                  />
                ))}
              </div>
            ) : (
              <Reviews course={c} />
            )}
          </main>
        </>
      )}
      <FixedAction disabled={busy} onClick={() => void start()}>
        {busy
          ? "正在处理…"
          : c.kind === "exam"
            ? examEntry(c,data).exhausted ? "查看考试规则与记录" : percent(c, data) === 100
              ? "查看规则并开始考试"
              : "开始考试"
            : percent(c, data) === 100
              ? `重新${labels[c.kind]}`
              : percent(c, data) > 0
                ? `继续${labels[c.kind]}`
                : `开始${labels[c.kind]}`}
        <ChevronRight size={18} />
      </FixedAction>
    </Page>
  );
}
export function Reviews({ course: c }: { course: Course }) {
  const { data, refresh, notify } = usePortal(),
    remote = useRemote(() => api.reviews(c.id), [c.id]);
  const own = data.reviews.find(
    (r) => r.courseId === c.id && r.version === c.version,
  );
  const [rating, setRating] = useState(own?.rating || 5),
    [comment, setComment] = useState(own?.comment || ""),
    [busy, setBusy] = useState(false);
  return (
    <div className="reviews">
      <h3>学员评价</h3>
      {remote.value?.items.length ? (
        <div className="rating-summary">
          <b>
            {(
              remote.value.items.reduce((sum, r) => sum + r.rating, 0) /
              remote.value.items.length
            ).toFixed(1)}
          </b>
          <div>
            <div className="stars">课程评分</div>
            <small>来自当前展示的 {remote.value.items.length} 条评价</small>
          </div>
        </div>
      ) : null}
      {!remote.value && !remote.error && <Loading />}
      {remote.value && !remote.value.items.length && (
        <p className="muted">暂无课程评价</p>
      )}
      {remote.error && <ErrorState message={remote.error} />}{" "}
      {remote.value?.items.map((r, index) => (
        <div className="review-item" key={index}>
          <div>
            <span className="mini-avatar">{r.name.slice(0, 1)}</span>
            <strong>{r.name}</strong>
          </div>
          <div className="stars" aria-label={`${r.rating}星`}>
            {"★".repeat(r.rating)}
          </div>
          <p>{r.comment || "已评分"}</p>
        </div>
      ))}
      {data.completed.includes(`${c.id}:${c.version}`) ? (
        <form
          className="mobile-form rating-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            try {
              await api.review(c.id, c.version, rating, comment);
              await refresh();
              remote.retry();
              notify("评价已保存");
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div role="group" aria-label="评分" className="rating-picker">
            <span>评分</span>
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                type="button"
                key={v}
                aria-label={`${v}星`}
                aria-pressed={rating === v}
                disabled={busy}
                onClick={() => setRating(v)}
              >
                <Star size={24} fill={v <= rating ? "currentColor" : "none"} />
              </button>
            ))}
            <small>{rating} 星</small>
          </div>
          <label>
            评价内容
            <textarea
              value={comment}
              maxLength={2000}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <button className="primary-button" disabled={busy}>
            提交评价
          </button>
        </form>
      ) : (
        <p className="muted">完成课程后可以评价</p>
      )}
    </div>
  );
}
export const knowledgeApps = [
  ["sales", "销冠话术", "客户场景与实战话术"],
  ["faq", "常见问题", "查找工作问题答案"],
  ["product", "产品知识", "产品资料与卖点"],
  ["policy", "业务政策", "政策说明与办理要求"],
  ["service", "服务规范", "标准服务流程"],
  ["cases", "岗位案例", "岗位经验与案例"],
];

export { Records, Messages, RankPage } from "./record-pages";
