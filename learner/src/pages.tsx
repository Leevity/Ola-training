import { KnowledgeDownload } from './knowledge-download';
import {withReturnTo,returnDestination,routeChoice,choiceRoute} from '../../shared/learner-navigation';
import {learningHistory} from '../../shared/learner-history';
import {keepListScroll} from '../../shared/learner-list-scroll';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Bookmark,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  GraduationCap,
  Headphones,
  History as HistoryIcon,
  Lightbulb,
  ListChecks,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Play,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  UserRound,
} from 'lucide-react';
import * as api from './api';
import { usePortal, useRemote } from './context';
import type { Course, Kind, Task, Chat } from './types';
import {
  actions,
  date,
  dateTime,
  key,
  labels,
  percent,
  taskPercent,
  taskStatus,
  nextLearningCourse,
  learningSummary,
  phaseActivity,
  examEntry,
  taskActivityHint,
  courseEntry,
} from './domain';
import { Cover, Empty, ErrorState, Loading, Modal, PageTitle, ProgressBar } from './ui';

export function CourseCard({ course }: { course: Course }) {
  const { data, go } = usePortal();
  const value = percent(course, data);
  return (
    <button className="course-card" onClick={() => go(`/course/${course.id}?v=${course.version}`)}>
      <div className="card-picture">
        <Cover src={course.cover} />
        <span className="image-label">{labels[course.kind]}</span>
        {data.favorites.includes(course.id) && (
          <Bookmark className="image-bookmark" size={17} fill="currentColor" />
        )}
      </div>
      <div className="course-card-body">
        <strong>{course.title}</strong>
        <p>{course.summary}</p>
        <div className="course-meta">
          <span>{course.category}</span>
          <span>
            <Clock3 size={13} />
            {course.kind === "exam" ? course.examMinutes : course.duration} 分钟
          </span>
        </div>
        {value > 0 && (
          <div className="card-progress">
            <ProgressBar value={value} />
            <span>{value === 100 ? '已完成' : value + '%'}</span>
          </div>
        )}
      </div>
    </button>
  );
}
export function HomePage() {
  const { data, user, go } = usePortal();
  const todo = data.tasks.filter((t) => !['已完成', '已到期', '未开始'].includes(taskStatus(t, data)));
  const resume = nextLearningCourse(data);
  const summary=learningSummary(data);
  const completedTasks = data.tasks.filter((t) => taskStatus(t, data) === '已完成').length;
  const historyCount = data.progress.length + data.training.length + data.attempts.length;
  return (
    <>
      <PageTitle title={`${user.name}，欢迎回来`} description="从今天的学习任务开始，继续积累你的岗位能力。">
        <span className="today">
          <CalendarDays size={16} />
          {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
        </span>
      </PageTitle>
      <div className="home-primary">
        <section className="resume-panel">
          <div className="resume-copy">
            <span className="eyebrow">
              {resume && percent(resume, data) > 0 && percent(resume, data) < 100
                ? '继续上次学习'
                : '今日学习推荐'}
            </span>
            <h2>{resume?.title || (data.courses.length ? '已完成当前学习课程' : '开启你的学习旅程')}</h2>
            <p>
              {resume?.summary ||
                (data.courses.length
                  ? '继续查看训练、考试与企业课程，巩固所学。'
                  : '企业发布课程后，即可在这里开始学习。')}
            </p>
            {resume && (
              <div className="resume-progress">
                <ProgressBar value={percent(resume, data)} />
                <span>{percent(resume, data)}% 已完成</span>
              </div>
            )}
            <button
              className="btn primary"
              onClick={() => go(resume ? courseEntry(resume,data).href : '/courses')}
            >
              {resume ? (percent(resume, data) > 0 ? '继续学习' : '开始学习') : '浏览课程'}
              <ArrowRight size={17} />
            </button>
          </div>
          <img src="/assets/home-resume-hero.webp" alt="学习成长插画" />
          <div className="resume-foot">
            <BookOpen size={14} />
            每一份投入，都会成为成长的积累
          </div>
        </section>
        <section className="today-panel">
          <div className="section-head">
            <h2>
              今日待办 <span>{todo.length}</span>
            </h2>
            <button className="text-btn" onClick={() => go('/tasks')}>
              全部
              <ChevronRight size={15} />
            </button>
          </div>
          {todo.length ? (
            todo.slice(0, 3).map((t) => (
              <button key={t.id} className="todo-row" onClick={() => go('/task/' + t.id)}>
                <span className="soft-icon">
                  <ListChecks size={19} />
                </span>
                <div>
                  <strong>{t.title}</strong>
                  <small>
                    <Clock3 size={12} />
                    {t.due} 截止
                  </small>
                </div>
                <ChevronRight size={17} />
              </button>
            ))
          ) : (
            <Empty
              title="暂时没有待办"
              hint="可以去课程中心自由学习"
              action="浏览课程"
              onAction={() => go('/courses')}
            />
          )}
          <div className="today-summary">
            <span>
              已完成任务<strong>{completedTasks}</strong>
            </span>
            <span>
              学习记录<strong>{historyCount}</strong>
            </span>
          </div>
        </section>
      </div>
      <div className="learning-strip">
        <div>
          <span className="soft-icon">
            <GraduationCap size={22} />
          </span>
          <strong>我的学习概览</strong>
        </div>
        <button onClick={() => go('/growth')}>
          <b>{summary.completedVersions}</b>
          <span>完成课程版本</span>
        </button>
        <button onClick={() => go('/history')}>
          <b>{summary.trainingCount}</b>
          <span>累计训练次数</span>
        </button>
        <button onClick={() => go('/history')}>
          <b>{summary.passedExams}</b>
          <span>通过考试</span>
        </button>
        <button className="strip-link" onClick={() => go('/my')}>
          个人中心
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="section-head section-space">
        <div>
          <h2>企业精选课程</h2>
          <p>把知识学懂，把技能练熟</p>
        </div>
        <button className="text-btn" onClick={() => go('/courses')}>
          查看全部课程
          <ArrowRight size={16} />
        </button>
      </div>
      {data.courses.some(c=>c.kind==='learn') ? (
        <div className="course-grid">
          {data.courses.filter(c=>c.kind==='learn').slice(0, 3).map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      ) : (
        <Empty title="课程即将上线" hint="管理员发布课程后会显示在这里" />
      )}
      <section className="whale-banner">
        <img src="/assets/ola-app-icon.png" alt="" />
        <div>
          <h3>有问题，找 ola</h3>
          <p>检索企业课程与知识资料，让学习更有方向。</p>
        </div>
        <button className="btn" onClick={() => go('/whale')}>
          打开 ola
          <ArrowRight size={16} />
        </button>
      </section>
    </>
  );
}
export function CourseCenter({
  favoritesOnly = false,
  initialSearch = '',
  searchAll = false,
}: {
  favoritesOnly?: boolean;
  initialSearch?: string;
  searchAll?: boolean;
}) {
  const { data } = usePortal();
  const [kind, setKind] = useState<Kind | 'all'>(searchAll ? 'all' : 'learn'),
    [q, setQ] = useState(initialSearch),
    [category, setCategory] = useState('全部'),
    [status, setStatus] = useState('all'),
    [mode, setMode] = useState('全部'),
    [sort, setSort] = useState('recent');
  const categories = [
    '全部',
    ...new Set(data.courses.filter((c) => kind === 'all' || c.kind === kind).map((c) => c.category)),
  ];
  const visible = data.courses
    .filter(
      (c) =>
        (kind === 'all' || c.kind === kind) &&
        (!favoritesOnly || data.favorites.includes(c.id)) &&
        (category === '全部' || c.category === category) &&
        (mode === '全部' || c.trainingMode === mode) &&
        (status === 'all' || (status === 'done' ? percent(c, data) === 100 : percent(c, data) < 100)) &&
        `${c.title} ${c.summary} ${c.category}`.toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'title'
        ? a.title.localeCompare(b.title, 'zh-CN')
        : sort === 'duration'
          ? a.duration - b.duration
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  return (
    <>
      <PageTitle
        title={favoritesOnly ? '我的收藏' : '课程中心'}
        description={
          favoritesOnly ? '收藏感兴趣的内容，随时回来继续学习。' : '选择课程、完成训练，检验你的学习成果。'
        }
      />
      <div className="catalog-heading">
        <div className="large-tabs">
          {([...(searchAll ? ['all'] : []), 'learn', 'train', 'exam'] as (Kind | 'all')[]).map((k) => (
            <button
              key={k}
              className={kind === k ? 'selected' : ''}
              onClick={() => {
                setKind(k);
                setCategory('全部');
                setMode('全部');
                setStatus('all');
              }}
            >
              {k === 'all' ? '全部' : labels[k]}
              <small>
                {
                  data.courses.filter(
                    (c) => (k === 'all' || c.kind === k) && (!favoritesOnly || data.favorites.includes(c.id)),
                  ).length
                }
              </small>
            </button>
          ))}
        </div>
        <label className="search-input">
          <Search size={18} />
          <input
            aria-label="搜索课程"
            placeholder="搜索名称、分类或关键词"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      <div className="catalog-filters">
        <div className="filter-row">
          <span>课程分类</span>
          {categories.map((item) => (
            <button
              key={item}
              className={category === item ? 'selected' : ''}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {kind === 'train' && (
          <div className="filter-row">
            <span>训练方式</span>
            {['全部', '人机训练', '跟读训练', '演讲训练'].map((item) => (
              <button key={item} className={mode === item ? 'selected' : ''} onClick={() => setMode(item)}>
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="section-head listing-heading">
        <div className="plain-tabs">
          {[
            ['all', '全部内容'],
            ['todo', '待完成'],
            ['done', '已完成'],
          ].map(([id, label]) => (
            <button key={id} className={status === id ? 'selected' : ''} onClick={() => setStatus(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="listing-right">
          <span>共 {visible.length} 门</span>
          <select aria-label="课程排序" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">最近更新</option>
            <option value="title">按名称排序</option>
            <option value="duration">学习时长优先</option>
          </select>
        </div>
      </div>
      {visible.length ? (
        <div className="course-grid">
          {visible.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      ) : (
        <Empty
          title={favoritesOnly ? '暂无符合条件的收藏' : '没有找到相关课程'}
          hint="试试其他分类或关键词"
          action="重置筛选"
          onAction={() => {
            setQ('');
            setCategory('全部');
            setMode('全部');
            setStatus('all');
          }}
        />
      )}
    </>
  );
}
function TaskRow({ task }: { task: Task }) {
  const { data, go } = usePortal();
  const value = taskPercent(task, data),
    status = taskStatus(task, data);
  return (
    <button className="task-row" onClick={() => go('/task/' + task.id)}>
      <span className="task-row-icon">
        <ListChecks size={25} />
      </span>
      <div className="task-main">
        <div>
          <h3>{task.title}</h3>
          <span
            className={'badge ' + (status === '已完成' ? 'success' : status === '已到期' ? 'muted' : 'blue')}
          >
            {status}
          </span>
        </div>
        <p>{task.description || '完成管理员指定的学习、训练和考试课程'}</p>
        {status==='进行中'&&taskActivityHint(task,data)&&<p className="task-activity-hint">{taskActivityHint(task,data)}</p>}
        <div className="task-metadata">
          <span>
            <CalendarDays size={14} />
            {task.start} 至 {task.due}
          </span>
          <span>{task.sequential ? '按顺序完成' : '自由选择顺序'}</span>
          {(['learn', 'train', 'exam'] as Kind[]).map((k) => (
            <span key={k}>
              {labels[k]} {task.snapshot.filter((c) => c.kind === k).length}
            </span>
          ))}
        </div>
      </div>
      <div className="task-row-progress">
        <span>
          <b>{value}%</b>
          <small>
            已完成 {task.snapshot.filter((c) => data.completed.includes(key(c))).length}/
            {task.snapshot.length}
          </small>
        </span>
        <ProgressBar value={value} />
      </div>
      <ChevronRight size={20} />
    </button>
  );
}
export function TaskCenter() {
  const { data } = usePortal();
  const [q, setQ] = useState(''),
    [status, setStatus] = useState('全部');
  const list = data.tasks.filter(
    (t) =>
      t.title.includes(q) &&
      (status === '全部' ||
        (status === '待完成'
          ? !['已完成', '已到期'].includes(taskStatus(t, data))
          : taskStatus(t, data) === status)),
  );
  const soon = data.tasks.filter(
    (t) =>
      taskStatus(t, data) !== '已完成' &&
      t.due >= new Date().toLocaleDateString('sv-SE') &&
      Date.parse(t.due) - Date.now() < 3 * 86400000,
  ).length;
  return (
    <>
      <PageTitle title="我的任务" description="企业指派的学习、训练与考试，在这里有序完成。" />
      <div className="task-overview">
        <div>
          <ListChecks size={25} />
          <strong>任务概览</strong>
          <small>仅展示分配给你的任务</small>
        </div>
        <span>
          <b>{data.tasks.filter((t) => !['已完成', '已到期'].includes(taskStatus(t, data))).length}</b>待完成
        </span>
        <span>
          <b>{soon}</b>即将到期
        </span>
        <span>
          <b>{data.tasks.filter((t) => taskStatus(t, data) === '已完成').length}</b>已完成
        </span>
      </div>
      <div className="section-head section-space">
        <div className="plain-tabs">
          {['全部', '待完成', '已完成', '已到期'].map((s) => (
            <button key={s} className={status === s ? 'selected' : ''} onClick={() => setStatus(s)}>
              {s}
            </button>
          ))}
        </div>
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label="搜索任务"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索任务名称"
          />
        </label>
      </div>
      <div className="task-list">
        {list.length ? (
          list.map((t) => <TaskRow key={t.id} task={t} />)
        ) : (
          <Empty
            title="暂无相关任务"
            hint="管理员分配的任务会显示在这里"
            action="查看全部任务"
            onAction={() => {
              setQ('');
              setStatus('全部');
            }}
          />
        )}
      </div>
    </>
  );
}
export function TaskDetail({ id }: { id: string }) {
  const { data, go } = usePortal();
  const t = data.tasks.find((t) => t.id === id);
  if (!t)
    return (
      <Empty
        title="任务不存在或不属于当前账号"
        hint="请返回任务中心查看已分配的任务"
        action="我的任务"
        onAction={() => go('/tasks')}
      />
    );
  const status = taskStatus(t, data),
    value = taskPercent(t, data);
  return (
    <>
      <PageTitle title={t.title} description={t.description} back={() => go(returnDestination(location.hash,'/tasks'))}>
        <span className="badge blue">{status}</span>
      </PageTitle>
      <section className="task-detail-summary">
        <div>
          <span>任务有效期</span>
          <strong>
            {t.start} — {t.due}
          </strong>
        </div>
        <div>
          <span>完成顺序</span>
          <strong>{t.sequential ? '按课程编排顺序' : '自由顺序'}</strong>
        </div>
        <div className="detail-progress">
          <span>
            任务进度 <b>{value}%</b>
          </span>
          <ProgressBar value={value} />
        </div>
      </section>
      <div className="section-head section-space">
        <h2>学习路径</h2>
        <span>{t.snapshot.length} 个阶段</span>
      </div>
      <div className="path-list">
        {t.snapshot.map((c, index) => {
          const done = data.completed.includes(key(c)),
            locked = t.sequential && t.snapshot.slice(0, index).some((p) => !data.completed.includes(key(p)));
          const activity=phaseActivity(c,data);
          const inactive = status === '未开始' || status === '已到期';
          return (
            <div key={c.id} className={'path-row ' + (done ? 'completed' : '')}>
              <span className="path-number">
                {done ? <Check size={21} /> : String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <span className="eyebrow">
                  阶段 {index + 1} · {labels[c.kind]}
                </span>
                <h3>{c.title}</h3>
                <p>
                  课程版本 v{c.version} ·{' '}
                  {done ? '已完成' : locked ? '完成前一阶段后解锁' : activity.status}
                </p>
              </div>
              <button
                className={'btn ' + (!done && !locked ? 'primary' : '')}
                disabled={!done && (locked || inactive)}
                onClick={() => go(withReturnTo(activity.href,location.hash))}
              >
                {locked && !done ? <LockKeyhole size={15} /> : null}
                {done ? '查看课程' : inactive ? status : locked ? '待解锁' : activity.action}
                {!locked && <ArrowRight size={16} />}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
export function CourseDetail({ id, version }: { id: string; version: number }) {
  const { data, go, run, refresh, notify } = usePortal();
  const v = version || data.courses.find((c) => c.id === id)?.version || 1;
  const remote = useRemote(() => api.course(id, v), [id, v]);
  const reviews = useRemote(() => api.reviews(id), [id]);
  const [tab, setTab] = useState(()=>routeChoice(location.hash,'tab',['intro','outline','reviews'],'intro')),
    [busy, setBusy] = useState(false),
    [rules, setRules] = useState(false);
  const c = remote.value;
  if (remote.error) return <ErrorState message={remote.error} retry={remote.retry} />;
  if (!c) return <Loading />;
  const done = percent(c, data),
    favorite = data.favorites.includes(id);
  const exam=examEntry(c,data);
  const start = async () => {
    setBusy(true);
    try {
      if (c.kind === 'learn') go(withReturnTo(`/content/${c.id}?v=${c.version}`,location.hash));
      else if (c.kind === 'exam') {
        if(exam.exhausted&&exam.latest){go(withReturnTo('/exam/'+exam.latest.id,location.hash));return;}
        const a = await api.startExam(c);
        go(withReturnTo('/exam/' + a.id,location.hash));
      } else {
        const existing = data.training.find(
          (t) => t.courseId === id && t.version === v && t.status === 'active',
        );
        const s = existing || (await api.startTraining(c));
        await refresh();
        go(withReturnTo('/training/' + s.id,location.hash));
      }
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle title="课程详情" back={() => go(returnDestination(location.hash,'/courses'))}>
        <button
          className={'btn ' + (favorite ? 'selected' : '')}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await run(
              async () => {
                await api.favorite(id, !favorite);
                await refresh();
              },
              favorite ? '已取消收藏' : '已加入收藏',
            );
            setBusy(false);
          }}
        >
          <Bookmark size={16} fill={favorite ? 'currentColor' : 'none'} />
          {favorite ? '已收藏' : '收藏课程'}
        </button>
      </PageTitle>
      <section className="course-detail-hero">
        <div className="detail-cover">
          <Cover src={c.cover} />
        </div>
        <div className="course-detail-copy">
          <div className="detail-tags">
            <span className="badge blue">{labels[c.kind]}课程</span>
            <span>{c.category}</span>
            <span>v{c.version}</span>
          </div>
          <h1>{c.title}</h1>
          <p>{c.summary}</p>
          <div className="detail-metadata">
            <span>
              <Clock3 size={16} />
              {c.kind === "exam" ? c.examMinutes : c.duration} 分钟
            </span>
            <span>
              <BookOpen size={16} />
              {c.kind === 'learn'
                ? c.lessons.length + ' 个课时'
                : c.kind === 'train'
                  ? c.trainingMode
                  : '满分 100 分'}
            </span>
            {done === 100 && (
              <span className="success-text">
                <CheckCircle2 size={16} />
                已完成
              </span>
            )}
          </div>
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => (c.kind === 'exam' ? setRules(true) : void start())}
          >
            {busy ? <Loader2 size={17} className="spin" /> : <Play size={16} fill="currentColor" />}
            {busy ? '正在准备' : c.kind === 'exam' ? exam.action : c.kind === 'learn' && done === 100 ? '重新学习' : c.kind === 'learn' && done > 0 ? '继续学习' : actions[c.kind]}
          </button>
        </div>
      </section>
      <div className="course-detail-layout">
        <section className="detail-main">
          <div className="large-tabs">
            {[
              ['intro', '课程介绍'],
              ['outline', c.kind === 'learn' ? '课程目录' : c.kind === 'train' ? '训练要求' : '考试规则'],
              ['reviews', '学员评价'],
            ].map(([id, title]) => (
              <button key={id} className={tab === id ? 'selected' : ''} onClick={() => {setTab(id);go(choiceRoute(location.hash,{tab:id}));}}>
                {title}
              </button>
            ))}
          </div>
          <div className="detail-text">
            {tab === 'intro' ? (
              <>
                <h2>{c.kind === 'train' ? '训练目标' : '课程简介'}</h2>
                <p>{c.kind === 'train' ? c.objective : c.summary}</p>
                {c.kind === 'train' && (
                  <>
                    <h2>模拟角色</h2>
                    <p>{c.role}</p>
                    <h2>评价标准</h2>
                    <p>{c.rubric}</p>
                  </>
                )}
                <h2>学习方式</h2>
                <p>
                  {c.kind === 'learn'
                    ? '按目录学习课程内容，完成课时后保存进度。'
                    : c.kind === 'train'
                      ? '阅读目标与标准，提交练习内容，结束后可查看对话记录与评价。'
                      : '开始后按时间完成作答，答案自动保存，提交后查看成绩。'}
                </p>
              </>
            ) : tab === 'outline' ? (
              c.kind === 'learn' ? (
                <div className="lesson-list">
                  {c.lessons.map((l, index) => (
                    <button key={l.id} onClick={() => go(withReturnTo(`/content/${id}?v=${v}&lesson=${index}`,location.hash))}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{l.title}</strong>
                        <small>{l.format}</small>
                      </div>
                      {data.progress.some(
                        (p) => p.courseId === id && p.version === v && p.lessonId === l.id,
                      ) ? (
                        <CheckCircle2 size={18} className="success-text" />
                      ) : (
                        <Play size={16} />
                      )}
                    </button>
                  ))}
                </div>
              ) : c.kind === 'train' ? (
                <div className="requirements">
                  <h3>{c.trainingMode}</h3>
                  <p>
                    <strong>模拟对象：</strong>
                    {c.role}
                  </p>
                  <p>
                    <strong>训练目标：</strong>
                    {c.objective}
                  </p>
                  <p>
                    <strong>评价维度：</strong>
                    {c.rubric}
                  </p>
                </div>
              ) : (
                <ExamRules course={c} />
              )
            ) : reviews.error ? (
              <ErrorState message={reviews.error} retry={reviews.retry} />
            ) : !reviews.value ? (
              <Loading />
            ) : reviews.value.items.length ? (
              <div className="reviews-list">
                {reviews.value.items.map((r, i) => (
                  <article key={i}>
                    <div>
                      <span className="mini-avatar">{r.name.slice(-1)}</span>
                      <strong>{r.name}</strong>
                      <small>
                        {date(r.updated_at)} · v{r.version}
                      </small>
                    </div>
                    <span className="stars">
                      {'★'.repeat(r.rating)}
                      {'☆'.repeat(5 - r.rating)}
                    </span>
                    <p>{r.comment || '学员已评分'}</p>
                  </article>
                ))}
              </div>
            ) : (
              <Empty title="还没有课程评价" hint="完成课程后，可以在成长评价中分享学习感受" />
            )}
          </div>
        </section>
        <aside className="course-inspector">
          <h3>我的学习</h3>
          <div className="inspector-progress">
            <strong>{done}%</strong>
            <span>完成进度</span>
          </div>
          <ProgressBar value={done} />
          <dl>
            <dt>课程类型</dt>
            <dd>{labels[c.kind]}课程</dd>
            <dt>预计时长</dt>
            <dd>{c.kind === "exam" ? c.examMinutes : c.duration} 分钟</dd>
            <dt>内容版本</dt>
            <dd>v{c.version}</dd>
          </dl>
          {c.kind === 'train' && (
            <div className="notice">当前支持文字练习与人工评价；自动对练和语音评分暂未开通。</div>
          )}
          {c.knowledgeIds.length > 0 && (
            <>
              <h3>关联学习资料</h3>
              {c.knowledgeIds.map((kid, index) => (
                <KnowledgeDownload
                  key={kid}
                  id={kid}
                  course={{ courseId: id, version: v }}
                  className="resource-link"
                  label={`下载资料 ${index + 1}`}
                />
              ))}
            </>
          )}
        </aside>
      </div>
      {rules && (
        <Modal
          title={exam.exhausted?'考试次数已用完':'开始考试前请确认'}
          onClose={() => !busy && setRules(false)}
          footer={
            <>
              <button className="btn" disabled={busy} onClick={() => setRules(false)}>
                再准备一下
              </button>
              <button className="btn primary" disabled={busy} onClick={() => void start()}>
                {busy ? '正在准备' : exam.action}
                <ArrowRight size={16} />
              </button>
            </>
          }
        >
          <h3>{c.title}</h3>
          <ExamRules course={c} />
          <div className="notice">{exam.exhausted?'本版本考试次数已用完，不能再开始新考试。可以查看最近答卷；已有合格记录继续有效。':'开始后即计时。离开页面不会暂停考试，重新进入将恢复尚未结束的答卷。'}</div>
        </Modal>
      )}
    </>
  );
}
function ExamRules({ course: c }: { course: Course }) {
  const { data } = usePortal();
  const count = data.attempts.filter((a) => a.courseId === c.id && a.version === c.version).length;
  return (
    <div className="rules-grid">
      {[
        ['考试时长', c.examMinutes + ' 分钟'],
        ['合格分数', c.examPass + ' 分'],
        ['满分', '100 分'],
        ['允许次数', c.examAttempts + ' 次'],
        ['已开始次数', count + ' 次'],
        ['提交方式', '手动 / 到时提交'],
      ].map(([title, value]) => (
        <div key={title}>
          <small>{title}</small>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
export function Profile({ onPasswordChanged }: { onPasswordChanged: () => void }) {
  const { user, data, go, notify } = usePortal();
  const [password, setPassword] = useState(false),
    [busy, setBusy] = useState(false),
    [current, setCurrent] = useState(''),
    [next, setNext] = useState(''),
    [again, setAgain] = useState('');
  const summary = learningSummary(data);
  return (
    <>
      <PageTitle title="个人中心" description="查看学习记录，记录每一次进步。" />
      <section className="profile-hero">
        <img src="/assets/default-avatar.webp" alt="" />
        <div>
          <span className="eyebrow">我的学习档案</span>
          <h1>{user.name}</h1>
          <p>
            {user.department} · {user.email}
          </p>
        </div>
        <button className="btn" onClick={() => setPassword(true)}>
          <Settings size={16} />
          账号安全
        </button>
      </section>
      <section className="profile-progress">
        <div>
          <strong>当前任务完成进度</strong>
          <b>{summary.taskCompletion}%</b>
        </div>
        <ProgressBar value={summary.taskCompletion} />
        <p>
          {summary.effectiveTasks
            ? `已完成 ${summary.effectiveDone}/${summary.effectiveTasks} 项有效任务，继续积累岗位能力。`
            : '暂无有效任务，可以先到课程中心自主学习。'}
        </p>
      </section>
      <div className="profile-stats">
        {[
          ['完成课程版本', summary.completedVersions, '/growth'],
          ['完成任务', data.tasks.filter((t) => taskStatus(t, data) === '已完成').length, '/tasks'],
          ['累计训练次数', summary.trainingCount, '/history'],
          ['通过考试', summary.passedExams, '/history'],
        ].map(([label, value, href]) => (
          <button key={label} onClick={() => go(String(href))}>
            <strong>{value}</strong>
            <span>{label}</span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
      <div className="profile-groups">
        {[
          {
            heading: '我的成长',
            entries: [
              { title: '排行榜', hint: '企业学习成长排名', href: '/rank', Icon: Trophy, color: 'blue' },
              { title: '成长评价', hint: '训练能力与课程评价', href: '/growth', Icon: Star, color: 'green' },
              {
                title: '训练历史',
                hint: '查看练习记录与复盘',
                href: '/history',
                Icon: HistoryIcon,
                color: 'violet',
              },
            ],
          },
          {
            heading: '学习概览',
            entries: [
              {
                title: '课程详情',
                hint: '查看课程与学习进度',
                href: '/courses',
                Icon: BookOpen,
                color: 'blue',
              },
              {
                title: '任务完成情况',
                hint: '查看指定任务与完成记录',
                href: '/tasks',
                Icon: ListChecks,
                color: 'blue',
              },
              {
                title: '我的收藏',
                hint: '保存感兴趣的课程与练习',
                href: '/favorites',
                Icon: Bookmark,
                color: 'green',
              },
              {
                title: '站内消息',
                hint: '任务通知与成绩反馈',
                href: '/messages',
                Icon: Bell,
                color: 'violet',
              },
            ],
          },
        ].map((group) => (
          <section key={group.heading}>
            <div className="section-head">
              <h2>{group.heading}</h2>
            </div>
            <div className="profile-menu">
              {group.entries.map(({ title, hint, href, Icon, color }) => (
                <button key={href} onClick={() => go(href)}>
                  <span className={`soft-icon ${color}`}>
                    <Icon size={22} />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <p>{hint}</p>
                  </div>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      {password && (
        <Modal
          title="修改登录密码"
          onClose={() => !busy && setPassword(false)}
          footer={
            <button form="password-form" className="btn primary" disabled={busy}>
              {busy ? '正在修改' : '修改并重新登录'}
            </button>
          }
        >
          <form
            id="password-form"
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (next !== again) {
                notify('两次输入的新密码不一致', true);
                return;
              }
              setBusy(true);
              try {
                await api.request('/auth/password', 'POST', { currentPassword: current, password: next });
                onPasswordChanged();
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              当前密码
              <input
                required
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <label>
              新密码
              <input
                required
                minLength={12}
                maxLength={128}
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </label>
            <label>
              确认新密码
              <input
                required
                minLength={12}
                maxLength={128}
                type="password"
                autoComplete="new-password"
                value={again}
                onChange={(e) => setAgain(e.target.value)}
              />
            </label>
            <p className="notice">新密码至少 12 位。修改后所有已登录设备需要重新登录。</p>
          </form>
        </Modal>
      )}
    </>
  );
}
export {Messages} from './messages-page';
export function History() {
  const { data, go,user } = usePortal();
  useEffect(()=>keepListScroll(user.tenantId+':'+user.memberId),[]);
  const [tab, setTab] = useState(()=>routeChoice(location.hash,'tab',['learn','train','exam'],'learn'));
  const lessons = learningHistory(data);
  const rows =
    tab === 'learn'
      ? lessons
      : tab === 'train'
        ? data.training.map((t) => ({
            id: t.id,
            version:t.version,
            title: t.title,
            at: t.createdAt,
            status:
              t.status === 'active'
                ? '练习中'
                : t.status === 'pending_review'
                  ? '待评价'
                  : `${t.score} 分 · ${t.status === 'completed' ? '已通过' : '继续加油'}`,
            href: `/${t.status === 'active' ? 'training' : 'recap'}/${t.id}`,
          }))
        : data.attempts.map((a) => ({
            id: a.id,
            version:a.version,
            title: a.title,
            at: a.startedAt,
            status:
              a.status === 'active'
                ? '答题中'
                : a.status === 'pending_review'
                  ? '待阅卷'
                  : `${a.score} 分 · ${a.passed ? '已通过' : '未通过'}`,
            href: '/exam/' + a.id,
          }));
  return (
    <>
      <PageTitle title="学习记录" description="学习过程与结果，随时回顾。" />
      <div className="large-tabs">
        {[
          ['learn', '课程学习'],
          ['train', '训练记录'],
          ['exam', '考试记录'],
        ].map(([id, title]) => (
          <button key={id} className={tab === id ? 'selected' : ''} onClick={() => {setTab(id);go(choiceRoute(location.hash,{tab:id}));}}>
            {title}
          </button>
        ))}
      </div>
      <div className="history-list">
        {rows.length ? (
          rows.map((r) => (
            <button key={r.id} onClick={() => go(withReturnTo(r.href,location.hash))}>
              <span className="soft-icon">
                {tab === 'learn' ? (
                  <BookOpen size={20} />
                ) : tab === 'train' ? (
                  <Headphones size={20} />
                ) : (
                  <FileText size={20} />
                )}
              </span>
              <div>
                <strong>{r.title}</strong>
                <p>v{r.version} · {dateTime(r.at)}</p>
              </div>
              <span className="badge blue">{r.status}</span>
              <ChevronRight size={18} />
            </button>
          ))
        ) : (
          <Empty
            title="还没有学习记录"
            hint="开始课程、训练或考试后，会自动记录在这里"
            action="去课程中心"
            onAction={() => go('/courses')}
          />
        )}
      </div>
    </>
  );
}
export function Growth() {
  const { data, go, run, refresh,user } = usePortal();
  useEffect(()=>keepListScroll(user.tenantId+':'+user.memberId),[]);
  const [edit, setEdit] = useState<Course | null>(null),
    [rating, setRating] = useState(5),
    [comment, setComment] = useState(''),
    [busy, setBusy] = useState(false);
  const [tab, setTab] = useState(()=>routeChoice(location.hash,'tab',['ability','reviews'],'ability'));
  const evaluated = data.training.filter(
    (t) => ['completed', 'failed'].includes(t.status) && t.score !== null,
  );
  const completed = data.courses.filter((c) => data.completed.includes(key(c)));
  return (
    <>
      <PageTitle title="成长评价" description="回顾已经掌握的内容，为课程留下你的评价。" />
      <div className="growth-summary">
        <span className="soft-icon">
          <Trophy size={28} />
        </span>
        <div>
          <h2>每一个完成，都是成长</h2>
          <p>
            已完成 {data.completed.length} 个课程版本 · 已提交 {data.reviews.length} 条评价
          </p>
        </div>
        <button className="btn" onClick={() => go('/history')}>
          查看学习记录
          <ArrowRight size={16} />
        </button>
      </div>
      <nav className="workspace-tabs" aria-label="成长评价分类">
        <button className={tab === 'ability' ? 'selected' : ''} onClick={() => {setTab('ability');go(choiceRoute(location.hash,{tab:'ability'}));}}>
          训练综合评价
        </button>
        <button className={tab === 'reviews' ? 'selected' : ''} onClick={() => {setTab('reviews');go(choiceRoute(location.hash,{tab:'reviews'}));}}>
          课程评价
        </button>
      </nav>
      {tab === 'ability' && (
        <section>
          {evaluated.length ? (
            <>
              <div className="ability-summary">
                <span className="soft-icon green">
                  <Trophy size={24} />
                </span>
                <div>
                  <p>已评价训练平均分</p>
                  <strong>
                    {Math.round(evaluated.reduce((n, t) => n + (t.score || 0), 0) / evaluated.length)}
                    <small>/100</small>
                  </strong>
                  <p>来自 {evaluated.length} 次已完成评价的训练</p>
                </div>
              </div>
              {evaluated.map((t) => (
                <button className="evaluation-row" key={t.id} onClick={() => go(withReturnTo('/recap/' + t.id,location.hash))}>
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>{t.title}</strong>
                    <small className="muted">v{t.version} · {dateTime(t.createdAt)}</small>
                    <p>{t.evaluation?.feedback || '查看评价与复盘'}</p>
                  </div>
                  <b>{t.score} 分</b>
                  <ChevronRight size={18} />
                </button>
              ))}
            </>
          ) : (
            <Empty
              title="暂无训练评价"
              hint="完成训练并由管理员评价后，会展示真实反馈"
              action="查看训练记录"
              onAction={() => go('/history')}
            />
          )}
        </section>
      )}
      <section hidden={tab !== 'reviews'}>
        <div className="section-head section-space">
          <h2>已完成课程</h2>
          <span>{completed.length} 门当前版本</span>
        </div>
        {completed.length ? (
          completed.map((c) => {
            const r = data.reviews.find((r) => r.courseId === c.id && r.version === c.version);
            return (
              <div className="growth-row" key={c.id}>
                <CheckCircle2 size={22} className="success-text" />
                <div>
                  <h3>{c.title}</h3>
                  <p>
                    {labels[c.kind]}课程 · v{c.version}{' '}
                    {r && <span className="stars">{'★'.repeat(r.rating)}</span>}
                  </p>
                  {r?.comment && <p>{r.comment}</p>}
                </div>
                <button
                  className="btn"
                  onClick={() => {
                    setEdit(c);
                    setRating(r?.rating || 5);
                    setComment(r?.comment || '');
                  }}
                >
                  {r ? '修改评价' : '评价课程'}
                  <Star size={15} />
                </button>
              </div>
            );
          })
        ) : (
          <Empty
            title="还没有已完成课程"
            hint="完成课程后，可以在这里分享学习感受"
            action="继续学习"
            onAction={() => go('/courses')}
          />
        )}
        <div className="notice section-space">评价针对具体课程版本；历史版本的完成记录保留在学习记录中。</div>
      </section>
      {edit && (
        <Modal
          title={'评价课程 · ' + edit.title}
          onClose={() => !busy && setEdit(null)}
          footer={
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const result = await run(async () => {
                  await api.review(edit.id, edit.version, rating, comment);
                  await refresh();
                  return true;
                }, '评价已保存');
                if (result) setEdit(null);
                setBusy(false);
              }}
            >
              {busy ? '正在保存' : '保存评价'}
            </button>
          }
        >
          <p>这门课程对你有帮助吗？</p>
          <div className="rating-picker" role="group" aria-label="课程评分">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} aria-label={`${n}星`} aria-pressed={rating === n} onClick={() => setRating(n)}>
                <Star size={32} fill={n <= rating ? 'currentColor' : 'none'} />
              </button>
            ))}
            <span>{rating} 分</span>
          </div>
          <label className="form-label">
            学习感受
            <textarea
              rows={4}
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="哪些内容对你最有帮助？"
            />
          </label>
        </Modal>
      )}
    </>
  );
}
export function Leaderboard() {
  const { user,go } = usePortal();
  const remote = useRemote(() =>
    api.request<{
      items: {
        id: string;
        name: string;
        department: string;
        tasks: number;
        lessons: number;
        exams: number;
        rank: number;
        isMe: boolean;
      }[];
    }>('/learn/leaderboard'),
  );
  const [mode, setMode] = useState(()=>routeChoice(location.hash,'mode',['people','teams'],'people'));
  if (remote.error) return <ErrorState message={remote.error} retry={remote.retry} />;
  if (!remote.value) return <Loading />;
  const items = remote.value.items;
  const teams = Object.entries(
    items.reduce<Record<string, typeof items>>((groups, r) => {
      (groups[r.department] ??= []).push(r);
      return groups;
    }, {}),
  )
    .map(([name, rows]) => ({
      id: name,
      name,
      department: '部门汇总',
      tasks: rows!.reduce((n, r) => n + r.tasks, 0),
      lessons: rows!.reduce((n, r) => n + r.lessons, 0),
      exams: rows!.reduce((n, r) => n + r.exams, 0),
      isMe: name === user.department,
    }))
    .sort((a, b) => b.tasks - a.tasks || b.lessons - a.lessons || b.exams - a.exams);
  const rows = mode === 'people' ? items : teams;
  return (
    <>
      <PageTitle title="学习排行榜" description="按完成任务、学习课时和通过考试数量依次排序。" />
      <div className="large-tabs">
        <button className={mode === 'people' ? 'selected' : ''} onClick={() => {setMode('people');go(choiceRoute(location.hash,{mode:'people'}));}}>
          个人排行
        </button>
        <button className={mode === 'teams' ? 'selected' : ''} onClick={() => {setMode('teams');go(choiceRoute(location.hash,{mode:'teams'}));}}>
          部门排行
        </button>
      </div>
      <div className="ranking-table">
        <div className="ranking-header">
          <span>排名</span>
          <span>{mode === 'people' ? '学员' : '部门'}</span>
          <span>完成任务</span>
          <span>学习课时</span>
          <span>通过考试</span>
        </div>
        {rows.map((r, index) => (
          <div className={'ranking-row ' + (r.isMe ? 'is-me' : '')} key={r.id}>
            <span className={index < 3 ? `rank-medal rank-${index+1}` : ''}>
              {index < 3 && <Trophy size={20} aria-hidden="true"/>}{index + 1}
            </span>
            <div>
              <strong>
                {r.name}
                {r.isMe && <em>我{mode === 'teams' ? '的部门' : ''}</em>}
              </strong>
              <small>{r.department}</small>
            </div>
            <b>{r.tasks}</b>
            <b>{r.lessons}</b>
            <b>{r.exams}</b>
          </div>
        ))}
      </div>
      <p className="muted footnote">{mode==='teams'?'部门排行按当前榜单最多100名已启用成员汇总。':'展示当前企业已启用成员的累计学习数据，最多显示100位学员。'}</p>
    </>
  );
}
export { WhaleHome, AssistantPage } from './assistant-workspace';
