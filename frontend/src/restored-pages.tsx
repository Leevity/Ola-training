import { useEffect, useRef, useState } from "react";
import {routeChoice,choiceRoute} from '../../shared/learner-navigation';
import {
  Bell,
  BookOpen,
  ChevronRight,
  Clock3,
  FileText,
  Filter,
  ListChecks,
  Search,
  Settings,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import type { Kind, Task } from "@ola/learner-client/types";
import {
  asset,
  CourseCard,
  displayCourse,
  Empty,
  Page,
  Progress,
  Recommendation,
  SectionTitle,
  Topbar,
} from "./ui";
import { usePortal } from "./portal";
import {
  percent,
  taskPercent,
  taskStatus,
  labels,
  key,
  learningSummary,
  nextLearningCourse,
  phaseActivity,
  taskActivityHint,
} from "./domain";
type Nav = { go: (path: string) => void; back: () => void };
const kinds: Kind[] = ["learn", "train", "exam"];
const modes = ["人机训练", "跟读训练", "演讲训练"];

export function HomePage({ go }: Nav) {
  const { data, session } = usePortal();
  const [banner, setBanner] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setBanner((v) => (v + 1) % 2), 4800);
    return () => clearInterval(timer);
  }, []);
  const todo = data.tasks.filter(
    (t) => !["已完成", "已到期", "未开始"].includes(taskStatus(t, data)),
  );
  const candidate = nextLearningCourse(data);
  const resume =
    candidate && percent(candidate, data) > 0 ? candidate : undefined;
  const banners = [
    {
      image: "home-banner-mobile.webp",
      title: "AI 助力成长",
      sub: "每天进步一点点",
    },
    {
      image: "home-resume-hero.webp",
      title: "学会表达，练好服务",
      sub: "从今天的任务开始",
    },
  ];
  const tenant = session.tenants.find((t) => t.id === session.user.tenantId);
  return (
    <Page tab="home" go={go} className="home-page">
      <header className="home-header">
        <div className="brand">
          <span className="brand-mark"><img src="/assets/ola-app-icon.png" alt="" /></span>
          <strong>
            ola<span>-training</span>
          </strong>
        </div>
        <div className="header-tools">
          <button aria-label="搜索课程" onClick={() => go("/search")}>
            <Search />
          </button>
          <button aria-label="站内消息" onClick={() => go("/messages")}>
            <Bell />
            {data.notifications.some((n) => !n.read) && <i />}
          </button>
        </div>
      </header>
      <div className="home-scroll">
        <button className="home-carousel" onClick={() => go("/courses")}>
          <img src={asset(banners[banner].image)} alt="" />
          <span className="carousel-copy">
            <strong>{banners[banner].title}</strong>
            <small>{banners[banner].sub}</small>
          </span>
          <span className="carousel-dots">
            {banners.map((_, i) => (
              <i key={i} className={banner === i ? "active" : ""} />
            ))}
          </span>
        </button>
        <section className="surface-section todo-section">
          <SectionTitle
            title={`今日待办 (${todo.length})`}
            action="查看全部"
            onAction={() => go("/tasks")}
          />
          {todo.length ? (
            <div className="todo-list">
              {todo.slice(0, 2).map((t, i) => (
                <button key={t.id} onClick={() => go(`/task/${t.id}`)}>
                  <span className={`todo-icon ${i ? "green" : "blue"}`}>
                    {i ? <Users size={23} /> : <FileText size={23} />}
                  </span>
                  <span className="todo-main">
                    <strong>{t.title}</strong>
                    <small>{t.description || "完成指定学习、训练和考试"}</small>
                    <em>
                      <Clock3 size={13} />
                      {t.due} 截止
                    </em>
                  </span>
                  <span className="todo-cta">
                    去完成
                    <ChevronRight size={16} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <Empty title="当前没有待办任务" hint="可以到课程中心自主学习" />
          )}
        </section>
        {resume && (
          <button
            className="resume-card"
            onClick={() => go(`/content/${resume.id}?v=${resume.version}`)}
          >
            <div className="resume-copy">
              <span className="eyebrow">继续上次学习</span>
              <strong>{resume.title}</strong>
              <p>接着完成上次的学习内容</p>
              <div className="resume-progress">
                <Progress value={percent(resume, data)} />
                <b>{percent(resume, data)}%</b>
              </div>
              <small>已完成课时会自动保存</small>
            </div>
            <img src={asset("home-resume-hero.webp")} alt="" />
            <span className="resume-action">
              继续学习
              <ChevronRight size={17} />
            </span>
          </button>
        )}
        <section className="home-courses">
          <SectionTitle
            title={`${tenant?.shortName || "企业"}专区`}
            action="查看更多课程"
            onAction={() => go("/courses")}
          />
          {data.courses.some(c=>c.kind==='learn') ? (
            <div className="course-grid">
              {data.courses.filter(c=>c.kind==='learn').slice(0, 4).map((c) => (
                <CourseCard
                  key={key(c)}
                  course={displayCourse(c, data)}
                  onClick={() => go(`/course/${c.id}?v=${c.version}`)}
                />
              ))}
            </div>
          ) : (
            <Empty title="暂无可学习课程" hint="管理员发布后会出现在这里" />
          )}
        </section>
      </div>
    </Page>
  );
}

export function CourseCenter({
  go,
  back,
  searchOnly = false,
  favoritesOnly = false,
}: Nav & { searchOnly?: boolean; favoritesOnly?: boolean }) {
  const { data } = usePortal();
  const initialFilters = new URLSearchParams(location.hash.split("?")[1]);
  const [kind, setKind] = useState<Kind>(() =>
      initialFilters.get("kind") === "train" ? "train" : initialFilters.get("kind") === "exam" ? "exam" : "learn",
    ),
    [status, setStatus] = useState(() => ['all','todo','done'].includes(initialFilters.get('status') || '') ? initialFilters.get('status')! : 'all'),
    [mode, setMode] = useState(() => initialFilters.get('mode') || '全部'),
    [category, setCategory] = useState(() => initialFilters.get('category') || '全部'),
    [query, setQuery] = useState(() => initialFilters.get('q') || ''),
    [latest, setLatest] = useState(() => initialFilters.get('sort') === 'latest');
  const special = searchOnly || favoritesOnly;
  useEffect(() => {
    if (special) return;
    const filters = new URLSearchParams();
    if (kind !== 'learn') filters.set('kind', kind);
    if (status !== 'all') filters.set('status', status);
    if (category !== '全部') filters.set('category', category);
    if (mode !== '全部') filters.set('mode', mode);
    if (query) filters.set('q', query);
    if (latest) filters.set('sort', 'latest');
    history.replaceState(history.state, '', `${location.pathname}${location.search}#/courses${filters.size ? `?${filters}` : ''}`);
  }, [special, kind, status, category, mode, query, latest]);
  const base = data.courses.filter(
    (c) =>
      (special || c.kind === kind) &&
      (!favoritesOnly || data.favorites.includes(c.id)),
  );
  const categories = [
    "全部",
    ...new Set(base.map((c) => c.category).filter(Boolean)),
  ];
  const filtered = base.filter(
    (c) =>
      (category === "全部" || c.category === category) &&
      (kind !== "train" ||
        special ||
        mode === "全部" ||
        c.trainingMode === mode) &&
      (c.title + " " + c.summary).toLowerCase().includes(query.toLowerCase()),
  );
  const visible = filtered
    .filter(
      (c) =>
        special ||
        (status === "done" ? percent(c, data) === 100 : status === 'todo' ? percent(c, data) < 100 : true),
    )
    .sort((a, b) =>
      latest ? Date.parse(b.updatedAt) - Date.parse(a.updatedAt) : 0,
    );
  const recommend = filtered.find((c) => percent(c, data) < 100);
  const reset = () => {
    setCategory("全部");
    setQuery("");
    setMode("全部");
    setStatus('all');
    setLatest(false);
  };
  return (
    <Page tab={special ? undefined : "courses"} go={go} className="course-page">
      {special ? (
        <Topbar title={favoritesOnly ? "我的收藏" : "搜索课程"} back={back} />
      ) : (
        <>
          <div className="center-hero">
            <div>
              <h1>课程中心</h1>
              <p>AI 赋能成长，成就更好的你</p>
            </div>
            <img src={asset("course-center-hero.webp")} alt="" />
          </div>
          <div className="main-tabs">
            {kinds.map((k) => (
              <button
                key={k}
                className={kind === k ? "selected" : ""}
                onClick={() => {
                  setKind(k);
                  setStatus("all");
                  reset();
                }}
              >
                {labels[k]}
              </button>
            ))}
          </div>
        </>
      )}
      <main className="page-gutter course-center-content">
        <div className="course-search">
          <label>
            <Search size={18} />
            <input
              aria-label="搜索课程"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索课程名称"
            />
          </label>
          <button onClick={() => setLatest((v) => !v)}>
            <Filter size={17} />
            {latest ? "最新排序" : "推荐排序"}
          </button>
        </div>
        {!special && (
          <div className="training-filters">
            {kind === "train" && (
              <div className="training-mode">
                <strong>训练方式</strong>
                {modes.map((m) => (
                  <button
                    key={m}
                    className={mode === m ? "selected" : ""}
                    onClick={() => {
                      setMode(m);
                      setStatus("all");
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            <div className="category-scroll">
              {categories.map((c) => (
                <button
                  key={c}
                  className={category === c ? "selected" : ""}
                  onClick={() => setCategory(c)}
                >
                  {c}
                  <small>
                    {
                      base.filter((b) => c === "全部" || b.category === c)
                        .length
                    }
                  </small>
                </button>
              ))}
            </div>
          </div>
        )}
        {!special && recommend && (
          <Recommendation course={displayCourse(recommend, data)} go={go} />
        )}
        <div className="listing-head">
          <h2>
            {favoritesOnly
              ? "收藏课程"
              : searchOnly
                ? "搜索结果"
                : kind === "train"
                  ? "精选训练"
                  : kind === "exam"
                    ? "全部考试"
                    : "全部课程"}
          </h2>
          {!special && (
            <div className="status-switch">
              <button
                className={status === 'all' ? 'selected' : ''}
                aria-pressed={status === 'all'}
                onClick={() => setStatus('all')}
              >全部</button>
              <button
                className={status === "todo" ? "selected" : ""}
                aria-pressed={status === 'todo'}
                onClick={() => setStatus("todo")}
              >
                {kind === "learn"
                  ? "待学"
                  : kind === "train"
                    ? "待训练"
                    : "待考"}
              </button>
              <button
                className={status === "done" ? "selected" : ""}
                aria-pressed={status === 'done'}
                onClick={() => setStatus("done")}
              >
                已完成
              </button>
            </div>
          )}
        </div>
        {visible.length ? (
          <div className="course-grid">
            {visible.map((c) => (
              <CourseCard
                key={key(c)}
                course={displayCourse(c, data)}
                onClick={() => go(`/course/${c.id}?v=${c.version}`)}
              />
            ))}
          </div>
        ) : (
          <Empty
            title={base.length === 0 ? '暂无课程' : !query && category === '全部' && status === 'todo' && filtered.length > 0 ? '当前课程都已完成' : '当前没有符合条件的课程'}
            hint={base.length === 0 ? '管理员发布课程后会显示在这里。' : status === 'todo' && filtered.some(c => percent(c, data) === 100) ? '可查看已完成课程，继续复习。' : '调整关键词或筛选条件，查看其他内容。'}
            action={base.length === 0 ? undefined : status === 'todo' && !query && category === '全部' && filtered.some(c => percent(c, data) === 100) ? '查看已完成' : '查看全部课程'}
            onAction={base.length === 0 ? undefined : status === 'todo' && !query && category === '全部' && filtered.some(c => percent(c, data) === 100) ? () => setStatus('done') : reset}
          />
        )}
      </main>
    </Page>
  );
}

function TaskCard({ task: t, go }: { task: Task; go: Nav["go"] }) {
  const { data } = usePortal();
  const status = taskStatus(t, data),
    done = t.snapshot.filter((c) => data.completed.includes(key(c))).length;
  return (
    <button className="task-card" onClick={() => go(`/task/${t.id}`)}>
      <div className="task-card-top">
        <strong>{t.title}</strong>
        <span
          className={`status ${status === "已完成" ? "success" : status === "进行中" ? "blue" : "warning"}`}
        >
          {status}
        </span>
      </div>
      <div className="task-dates">
        <Clock3 size={14} />
        有效期 {t.start} 至 {t.due}
      </div>
      <div className="task-composition">
        {kinds.map((k) => (
          <span key={k}>
            <b>{k === "learn" ? "学" : k === "train" ? "训" : "考"}</b>
            {t.snapshot.filter((c) => c.kind === k).length} 门
          </span>
        ))}
      </div>
      <div className="task-progress-label">
        <span>
          已完成 {done}/{t.snapshot.length} 门课程
        </span>
      </div>
      <Progress value={taskPercent(t, data)} />
      {status==='进行中'&&taskActivityHint(t,data)&&<p className="task-activity-hint">{taskActivityHint(t,data)}</p>}
      <div className="task-card-footer">
        {status === "已完成"
          ? "查看任务"
          : status === "进行中"
            ? "继续任务"
            : "查看学习计划"}
        <ChevronRight size={16} />
      </div>
    </button>
  );
}
export function TaskCenter({ go }: Nav) {
  const { data } = usePortal();
  const initialFilters = new URLSearchParams(location.hash.split('?')[1]);
  const [status, setStatus] = useState(()=>initialFilters.get('status')==='done'?'done':'todo'),
    [search, setSearch] = useState(() => initialFilters.get('q') || ''),
    [filter, setFilter] = useState(() => initialFilters.get('filter') === 'active');
  useEffect(() => {
    const filters = new URLSearchParams();
    if (status === 'done') filters.set('status', 'done');
    if (search) filters.set('q', search);
    if (filter) filters.set('filter', 'active');
    const route = location.hash.startsWith('#/my/tasks') ? '/my/tasks' : '/tasks';
    history.replaceState(history.state, '', `${location.pathname}${location.search}#${route}${filters.size ? `?${filters}` : ''}`);
  }, [status, search, filter]);
  const pending = data.tasks.filter((t) => taskStatus(t, data) !== "已完成");
  const today = new Date().toLocaleDateString("sv-SE");
  const soon = pending.filter(
    (t) =>
      t.start <= today &&
      t.due >= today &&
      Date.parse(t.due) - Date.parse(today) <= 3 * 86400000,
  );
  const visible = data.tasks.filter(
    (t) =>
      (status === "done"
        ? taskStatus(t, data) === "已完成"
        : taskStatus(t, data) !== "已完成") &&
      t.title.includes(search) &&
      (!filter || taskStatus(t, data) === "进行中"),
  );
  return (
    <Page tab="tasks" go={go} className="task-page">
      <div className="simple-hero">
        <h1>任务中心</h1>
        <p>学习、训练、考试任务，一站处理</p>
      </div>
      <main className="page-gutter">
        <div className="task-overview">
          <div>
            <strong>任务概览</strong>
            <small>管理员指派的任务</small>
          </div>
          <div>
            <small>待完成</small>
            <b>{pending.length}</b>
          </div>
          <div>
            <small>即将到期</small>
            <b>{soon.length}</b>
          </div>
          <div>
            <small>已完成</small>
            <b>{data.tasks.length - pending.length}</b>
          </div>
        </div>
        <div className="search-line">
          <Search size={18} />
          <input
            aria-label="搜索任务"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索任务名称"
          />
        </div>
        <div className="task-list-controls">
          <div className="plain-tabs">
            <button
              className={status === "todo" ? "selected" : ""}
              aria-pressed={status === 'todo'}
              onClick={() => setStatus("todo")}
            >
              待办
            </button>
            <button
              className={status === "done" ? "selected" : ""}
              aria-pressed={status === 'done'}
              onClick={() => setStatus("done")}
            >
              已完成
            </button>
          </div>
          <button
            className={filter ? "filter selected" : "filter"}
            aria-pressed={filter}
            onClick={() => setFilter((v) => !v)}
          >
            <Filter size={17} />
            {filter ? "进行中" : "筛选"}
          </button>
        </div>
        <div className="task-list">
          {visible.length ? (
            visible.map((t) => <TaskCard key={t.id} task={t} go={go} />)
          ) : (
            <Empty
              title={search || filter ? '没有符合条件的任务' : status === 'todo' && data.tasks.length > 0 && pending.length === 0 ? '任务已全部完成' : status === 'done' ? '还没有已完成的任务' : '暂无待办任务'}
              hint={search || filter ? '调整关键词或筛选条件再试。' : status === 'todo' && data.tasks.length > 0 && pending.length === 0 ? '已完成的任务可以随时查看和复习。' : '有新的任务分配后会显示在这里。'}
              action={search || filter ? '清空筛选' : status === 'todo' && data.tasks.length > 0 && pending.length === 0 ? '查看已完成' : undefined}
              onAction={search || filter ? () => { setSearch(''); setFilter(false); } : status === 'todo' && data.tasks.length > 0 && pending.length === 0 ? () => setStatus('done') : undefined}
            />
          )}
        </div>
      </main>
    </Page>
  );
}
export function TaskDetail({ id, go, back }: Nav & { id: string }) {
  const { data } = usePortal();
  const t = data.tasks.find((t) => t.id === id);
  const [stage, setStage] = useState<Kind>(
    () => routeChoice(location.hash,'stage',kinds,t?.snapshot.find((c) => !data.completed.includes(key(c)))?.kind || 'learn') as Kind,
  );
  useEffect(()=>setStage(routeChoice(location.hash,'stage',kinds,t?.snapshot.find(c=>!data.completed.includes(key(c)))?.kind||'learn') as Kind),[id,location.hash,data.completed.join('|')]);
  if (!t)
    return (
      <Page go={go}>
        <Topbar title="任务详情" back={back} />
        <Empty title="任务不可访问" hint="任务可能已归档，或未分配给你" />
      </Page>
    );
  const done = t.snapshot.filter((c) => data.completed.includes(key(c))).length;
  const status = taskStatus(t, data);
  return (
    <Page go={go} className="detail-page">
      <Topbar title="任务详情" back={back} />
      <div className="task-detail-hero">
        <div className="task-detail-copy">
          <span className="eyebrow">
            综合任务 · {t.sequential ? "按顺序完成" : "自由安排学习"}
          </span>
          <h1>{t.title}</h1>
          <div className="inline-progress">
            <small>
              整体进度 {done}/{t.snapshot.length}
            </small>
            <Progress value={taskPercent(t, data)} />
            <b>{taskPercent(t, data)}%</b>
          </div>
          <p>
            <Clock3 size={14} />
            {t.due} 截止 · {status}
          </p>
        </div>
        <img src={asset("task-check-illustration.jpg")} alt="" />
      </div>
      <div className="stage-tabs">
        {kinds.map((k, i) => {
          const list = t.snapshot.filter((c) => c.kind === k),
            completed = list.filter((c) =>
              data.completed.includes(key(c)),
            ).length;
          const lockedStage=list.length>0&&t.sequential&&t.snapshot.slice(0,t.snapshot.indexOf(list[0])).some(c=>!data.completed.includes(key(c)));
          const activeStage=list.map(c=>phaseActivity(c,data).status).find(s=>s!=='待开始'&&s!=='已完成');
          return (
            <button
              key={k}
              className={stage === k ? "selected" : ""}
              onClick={() => {setStage(k);go(choiceRoute(location.hash,{stage:k}));}}
            >
              <span className="stage-num">0{i + 1}</span>
              <span>
                <strong>{labels[k]}</strong>
                <small>
                  {!list.length
                    ? "无课程"
                    : completed === list.length
                      ? "已完成"
                      : completed
                        ? "进行中"
                        : lockedStage ? '待解锁' : activeStage==='待评价'||activeStage==='待阅卷'?activeStage:activeStage?'进行中':"待开始"}
                </small>
              </span>
              <em>
                {completed}/{list.length}
              </em>
            </button>
          );
        })}
      </div>
      <main className="page-gutter task-detail-main">
        <SectionTitle
          title={`${labels[stage]}课程`}
          action={`${t.snapshot.filter((c) => c.kind === stage).length} 门课程`}
        />
        {t.snapshot
          .filter((c) => c.kind === stage)
          .map((c) => {
            const index = t.snapshot.indexOf(c),
              finished = data.completed.includes(key(c)),
              locked =
                t.sequential &&
                t.snapshot
                  .slice(0, index)
                  .some((p) => !data.completed.includes(key(p))),
              blocked = locked || status === "未开始" || status === "已到期";
            const current = data.courses.find(
              (x) => x.id === c.id && x.version === c.version,
            );
            const activity=phaseActivity(c,data);
            return (
              <button
                className="task-course-row"
                key={key(c)}
                disabled={blocked && !finished}
                onClick={() => go(activity.href)}
              >
                <div className="task-row-cover">
                  <img
                    className="cover-back"
                    src={current?.cover || asset("course-communication.webp")}
                    alt=""
                  />
                  <img
                    className="cover-front"
                    src={current?.cover || asset("course-communication.webp")}
                    alt=""
                  />
                  <span>{labels[c.kind]}课程</span>
                </div>
                <div className="task-row-body">
                  <div>
                    <strong>{c.title}</strong>
                    <span className={`status ${finished ? "success" : blocked ? "muted" : "blue"}`}>
                      {finished
                        ? "已完成"
                        : locked
                          ? "待解锁"
                          : status === "未开始" || status === "已到期"
                            ? status
                            : activity.status}
                    </span>
                  </div>
                  {locked&&!finished&&<p className="task-lock-hint">完成前一阶段后解锁</p>}
                  <div className="inline-progress">
                    <Progress
                      value={
                        finished ? 100 : current ? percent(current, data) : 0
                      }
                    />
                    <b>
                      {finished ? 100 : current ? percent(current, data) : 0}%
                    </b>
                  </div>
                  <footer>
                    <small>课程版本 v{c.version}</small>
                    <b>
                      {blocked && !finished
                        ? "暂不可开始"
                        : finished
                          ? "查看课程"
                          : activity.action}
                      <ChevronRight size={15} />
                    </b>
                  </footer>
                </div>
              </button>
            );
          })}
        {!t.snapshot.some((c) => c.kind === stage) && (
          <Empty title="此阶段没有课程" hint="可切换其他阶段查看学习计划" />
        )}
      </main>
    </Page>
  );
}

export function MyPage({ go }: Nav) {
  const { data, session } = usePortal();
  const summary = learningSummary(data),
    done = summary.effectiveDone,
    pending = summary.pendingTasks,
    progress = summary.taskCompletion;
  const active = { length: summary.effectiveTasks };
  return (
    <Page tab="my" go={go} className="my-page">
      <div className="my-hero">
        <div className="my-person">
          <img src={asset("default-avatar.webp")} alt="" />
          <div>
            <strong>{session.user.name}</strong>
            <small>{session.user.department} · 每一步都向前</small>
          </div>
          <button
            className="icon-button account-entry"
            aria-label="账号设置"
            onClick={() => go("/my/settings")}
          >
            <Settings size={20} />
          </button>
        </div>
        <div className="my-progress">
          <div>
            <span>当前任务完成进度</span>
            <b>{progress}%</b>
          </div>
          <Progress value={progress} />
          <p>
            {active.length
              ? `已完成 ${done}/${active.length} 项有效任务，继续积累岗位能力`
              : "暂无有效任务，可以先到课程中心自主学习"}
          </p>
        </div>
      </div>
      <main className="page-gutter">
        <div className="my-stat-line">
          <button onClick={() => go("/my/courses")}>
            <b>{summary.completedVersions}</b>
            <span>完成课程版本</span>
          </button>
          <button onClick={() => go("/tasks")}>
            <b>{pending}</b>
            <span>待完成任务</span>
          </button>
          <button onClick={() => go("/my/history")}>
            <b>{summary.trainingCount}</b>
            <span>累计训练次数</span>
          </button>
        </div>
        <SectionTitle title="我的成长" />
        <div className="my-entry-list">
          <button onClick={() => go("/my/rank")}>
            <span className="my-entry-icon blue">
              <Trophy size={21} />
            </span>
            <span>
              <strong>排行榜</strong>
              <small>看看企业的学习成长排名</small>
            </span>
            <ChevronRight />
          </button>
          <button onClick={() => go("/my/growth")}>
            <span className="my-entry-icon green">
              <Star size={21} />
            </span>
            <span>
              <strong>成长评价</strong>
              <small>训练能力与课程评价</small>
            </span>
            <ChevronRight />
          </button>
          <button onClick={() => go("/my/history")}>
            <span className="my-entry-icon violet">
              <Clock3 size={21} />
            </span>
            <span>
              <strong>训练历史</strong>
              <small>查看练习记录与复盘</small>
            </span>
            <ChevronRight />
          </button>
        </div>
        <SectionTitle title="学习概览" />
        <div className="my-overview">
          <button onClick={() => go("/my/courses")}>
            <BookOpen size={20} />
            <strong>课程详情</strong>
            <span>
              完成 {data.completed.length} 个版本
              <ChevronRight size={16} />
            </span>
          </button>
          <button onClick={() => go("/tasks")}>
            <ListChecks size={20} />
            <strong>任务完成情况</strong>
            <span>
              已完成{" "}
              {
                data.tasks.filter((t) => taskStatus(t, data) === "已完成")
                  .length
              }{" "}
              项<ChevronRight size={16} />
            </span>
          </button>
          <button onClick={() => go("/my/favorites")}>
            <Star size={20} />
            <strong>我的收藏</strong>
            <span>
              {data.favorites.length} 门<ChevronRight size={16} />
            </span>
          </button>
          <button onClick={() => go("/messages")}>
            <Bell size={20} />
            <strong>站内消息</strong>
            <span>
              {data.notifications.filter((n) => !n.read).length} 条未读
              <ChevronRight size={16} />
            </span>
          </button>
        </div>
      </main>
    </Page>
  );
}
export function AccountPage({ go, back }: Nav) {
  const { session, changeTenant, logout, notify, refresh } = usePortal();
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page go={go}>
      <Topbar title="账号设置" back={back} />
      <main className="page-gutter account-settings">
        <div className="light-hero">
          <h1>{session.user.name}</h1>
          <p>{session.user.department}</p>
        </div>
        <label className="mobile-form">
          当前企业
          <select
            disabled={busy}
            value={session.user.tenantId}
            onChange={(e) => void run(() => changeTenant(e.target.value))}
          >
            {session.tenants.map((t) => (
              <option value={t.id} key={t.id}>
                {t.shortName}
              </option>
            ))}
          </select>
        </label>
        <div className="my-overview">
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await refresh();
                notify("学习数据已刷新");
              })
            }
          >
            <strong>刷新学习数据</strong>
            <ChevronRight size={16} />
          </button>
          <button disabled={busy} onClick={() => void run(logout)}>
            <strong>退出登录</strong>
            <ChevronRight size={16} />
          </button>
        </div>
      </main>
    </Page>
  );
}
