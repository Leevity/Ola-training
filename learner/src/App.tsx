import {allowLeaving,navigateHash,watchHashRoute} from '../../shared/navigation-guard';
import {watchLearningRefresh} from '../../shared/learner-refresh';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Bell,
  Bot,
  Box,
  NotebookText,
  BookOpen,
  ChevronRight,
  GraduationCap,
  Home,
  ListChecks,
  Loader2,
  LogOut,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import * as api from './api';
import type { Overview, Tenant, User } from './types';
import { PortalContext } from './context';
import { Empty, ErrorState, Loading, Modal } from './ui';
import {
  HomePage,
  CourseCenter,
  TaskCenter,
  TaskDetail,
  CourseDetail,
  Profile,
  Messages,
  Leaderboard,
  Growth,
  History,
  WhaleHome,
  AssistantPage,
} from './pages';
import { StudyPage, ExamPage, TrainingPage, RecapPage } from './workflows';
const nav = [
  { id: 'home', label: '首页', Icon: Box },
  { id: 'courses', label: '课程中心', Icon: NotebookText },
  { id: 'whale', label: 'ola', Icon: Bot },
  { id: 'tasks', label: '我的任务', Icon: ListChecks },
  { id: 'my', label: '个人中心', Icon: UserRound },
];
function readRoute() {
  return location.hash.slice(1) || '/home';
}
export default function App() {
  const [session, setSession] = useState<{ user: User; tenants: Tenant[] } | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setSession(await api.me());
    } catch (e) {
      if (!(e instanceof api.ApiError) || e.status !== 401) setError((e as Error).message);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    const expired = () => setSession(null);
    window.addEventListener('ola:expired', expired);
    return () => window.removeEventListener('ola:expired', expired);
  }, []);
  if (loading)
    return (
      <div className="boot">
        <Loading text="正在连接学习中心" />
      </div>
    );
  if (error)
    return (
      <div className="boot">
        <ErrorState message={error} retry={() => void load()} />
      </div>
    );
  if (!session) return <Login onLogin={load} />;
  return (
    <Workspace
      key={session.user.tenantId + session.user.id}
      session={session}
      reloadSession={load}
      onLogout={() => setSession(null)}
    />
  );
}
function Login({ onLogin }: { onLogin: () => Promise<void> }) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(email, password);
      await onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-page">
      <section className="login-story">
        <a className="brand" href="#/home">
          <span className="brand-symbol">
            <img src="/assets/ola-app-icon.png" alt="" />
          </span>
          <strong>
            ola<span>-training</span>
          </strong>
        </a>
        <div>
          <span className="eyebrow">企业学习与能力训练</span>
          <h1>
            学有所用，
            <br />
            每一步都向前。
          </h1>
          <p>
            从一门课程、一次练习开始，
            <br />
            把所学变成工作中的能力。
          </p>
          <img src="/assets/home-resume-hero.webp" alt="学习与成长插画" />
        </div>
        <small>课程学习 · 情景训练 · 岗位考试</small>
      </section>
      <section className="login-form">
        <div>
          <span className="eyebrow">欢迎回来</span>
          <h2>登录学习中心</h2>
          <p>使用企业为你开通的账号继续学习</p>
          <form onSubmit={submit}>
            <label>
              登录邮箱
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入登录邮箱"
              />
            </label>
            <label>
              密码
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
              />
            </label>
            {error && (
              <div role="alert" className="error-note">
                {error}
              </div>
            )}
            <button className="btn primary full" disabled={busy}>
              {busy ? <Loader2 className="spin" size={18} /> : null}
              {busy ? '正在登录' : '登录'}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="login-help">
            <ShieldCheck size={16} />
            账号由企业管理员开通，无法登录请联系管理员。
          </div>
        </div>
      </section>
    </div>
  );
}
function Workspace({
  session,
  reloadSession,
  onLogout,
}: {
  session: { user: User; tenants: Tenant[] };
  reloadSession: () => Promise<void>;
  onLogout: () => void;
}) {
  const [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState(''),
    [route, setRoute] = useState(readRoute),
    [toast, setToast] = useState<{ message: string; error: boolean } | null>(null),
    [search, setSearch] = useState(''),
    [refreshing, setRefreshing] = useState(false),
    [help, setHelp] = useState(false),
    [confirmLogout, setConfirmLogout] = useState(false),
    [switching, setSwitching] = useState(false);
  const alive = useRef(true);
  const overviewRequest=useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const refresh = async () => {
    const request=++overviewRequest.current;
    const next = await api.overview();
    if (alive.current&&request===overviewRequest.current) {
      setData(next);
      setError('');
    }
    return next;
  };
  useEffect(()=>watchLearningRefresh(refresh,e=>setToast({message:'学习数据同步失败，请重试刷新',error:true})),[]);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
    const handler = (next:string) => {
      setRoute(next);
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    return watchHashRoute(handler);
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const go = (path: string) => {
    navigateHash(path);
  };
  const notify = (message: string, error = false) => setToast({ message, error });
  const run = async <T,>(action: () => Promise<T>, success?: string): Promise<T | undefined> => {
    try {
      const result = await action();
      if (success) notify(success);
      return result;
    } catch (e) {
      notify((e as Error).message, true);
      return undefined;
    }
  };
  const [path, query = ''] = route.split('?');
  const params = new URLSearchParams(query);
  const segments = path.split('/').filter(Boolean);
  const detail = ['course', 'content', 'training', 'recap', 'exam', 'task', 'chat', 'assistant'].includes(
    segments[0],
  );
  const active = ['course', 'content', 'exam', 'training', 'recap', 'favorites', 'search'].includes(
    segments[0],
  )
    ? 'courses'
    : ['rank', 'growth', 'history'].includes(segments[0])
      ? 'my'
      : ['assistant', 'chat'].includes(segments[0])
        ? 'whale'
        : segments[0] === 'task'
          ? 'tasks'
          : segments[0] || 'home';
  const tenant = session.tenants.find((t) => t.id === session.user.tenantId);
  const unread = data?.notifications.filter((n) => !n.read).length || 0;
  const content = () => {
    if (!data)
      return error ? (
        <ErrorState message={error} retry={() => void refresh().catch((e) => setError(e.message))} />
      ) : (
        <Loading />
      );
    if (path === '/home' || path === '/') return <HomePage />;
    if (path === '/courses' || path === '/search' || path === '/favorites')
      return (
        <CourseCenter
          key={`${path}:${params.get('q')||''}`}
          searchAll={path === '/search'}
          favoritesOnly={path === '/favorites'}
          initialSearch={params.get('q') || ''}
        />
      );
    if (path === '/tasks') return <TaskCenter />;
    if (segments[0] === 'task') return <TaskDetail id={segments[1]} />;
    if (segments[0] === 'course') return <CourseDetail id={segments[1]} version={Number(params.get('v'))} />;
    if (segments[0] === 'content') return <StudyPage id={segments[1]} version={Number(params.get('v'))} />;
    if (segments[0] === 'exam') return <ExamPage id={segments[1]} />;
    if (segments[0] === 'training') return <TrainingPage id={segments[1]} />;
    if (segments[0] === 'recap') return <RecapPage id={segments[1]} />;
    if (path === '/my') return <Profile onPasswordChanged={onLogout} />;
    if (path === '/messages') return <Messages />;
    if (path === '/rank') return <Leaderboard />;
    if (path === '/growth') return <Growth />;
    if (path === '/history') return <History />;
    if (path === '/whale') return <WhaleHome />;
    if (segments[0] === 'assistant') return <AssistantPage app={segments[1]} />;
    if (segments[0] === 'chat') return <AssistantPage sessionId={segments[1]} />;
    return (
      <Empty title="页面未找到" hint="从学习首页重新开始" action="返回首页" onAction={() => go('/home')} />
    );
  };
  return (
    <PortalContext.Provider
      value={{ data: data!, user: session.user, tenants: session.tenants, refresh, go, notify, run }}
    >
      <div className="app-shell">
        <aside className="sidebar">
          <a href="#/home" className="brand">
            <span className="brand-symbol">
              <img src="/assets/ola-app-icon.png" alt="" />
            </span>
            <strong>
              ola<span>-training</span>
            </strong>
          </a>
          <span className="sidebar-label">学习空间</span>
          <nav aria-label="主导航">
            {nav.map(({ id, label, Icon }) => (
              <a
                key={id}
                href={'#/' + id}
                className={active === id ? 'active' : ''}
                aria-current={active === id ? 'page' : undefined}
              >
                {id === 'whale' ? <img className="ola-nav-icon" src="/assets/ola-app-icon.png" alt="" /> : <Icon size={20} />}
                <span>{label}</span>
                {id === 'tasks' && data && (
                  <small>{data.tasks.filter((t) => !t.completedMemberIds.length).length}</small>
                )}
              </a>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button onClick={() => setHelp(true)}>
              <BookOpen size={18} />
              学习指南
              <ChevronRight size={16} />
            </button>
            <div>
              <span className="online-dot" />
              学习记录实时保存
            </div>
            <small>ola-training · PC 学员端</small>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="breadcrumb">
              学习中心<span>/</span>
              <strong>{nav.find((n) => n.id === active)?.label || '我的学习'}</strong>
              {detail && (
                <>
                  <span>/</span>
                  <span>详情</span>
                </>
              )}
            </div>
            <div className="top-tools">
              <form
                className="top-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  go('/search?q=' + encodeURIComponent(search));
                }}
              >
                <Search size={17} />
                <input
                  aria-label="全局搜索课程"
                  placeholder="搜索课程、训练、考试"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>
              <select
                aria-label="切换企业"
                value={session.user.tenantId}
                disabled={switching}
                onChange={async (e) => {
                  if(!allowLeaving())return;
                  setSwitching(true);
                  const result = await run(() =>
                    api.request('/auth/switch-tenant', 'POST', { tenantId: e.target.value }),
                  );
                  if (result !== undefined) await reloadSession();
                  else setSwitching(false);
                }}
              >
                {session.tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.shortName}
                  </option>
                ))}
              </select>
              <button
                className="icon-btn"
                aria-label="刷新学习数据"
                disabled={refreshing}
                onClick={async () => {
                  setRefreshing(true);
                  await run(refresh, '学习数据已更新');
                  setRefreshing(false);
                }}
              >
                <RefreshCw size={19} className={refreshing ? 'spin' : ''} />
              </button>
              <button
                className="icon-btn notice-btn"
                aria-label={`站内消息${unread ? '，' + unread + '条未读' : ''}`}
                onClick={() => go('/messages')}
              >
                <Bell size={20} />
                {unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}
              </button>
              <button className="avatar-button" onClick={() => go('/my')} aria-label="个人中心">
                <img src="/assets/default-avatar.webp" alt="" />
                <span>{session.user.name}</span>
              </button>
            </div>
          </header>
          <main className={'main-content ' + (detail ? 'detail-content' : '')} key={route}>
            {switching ? <Loading text="正在切换企业" /> : content()}
          </main>
          <footer className="app-footer">
            <span>{tenant?.name}</span>
            <span>ola-training · 让成长看得见</span>
            <button onClick={() => setConfirmLogout(true)}>
              <LogOut size={13} />
              退出登录
            </button>
          </footer>
        </div>
      </div>
      {toast && (
        <div role={toast.error ? 'alert' : 'status'} className={'toast ' + (toast.error ? 'error' : '')}>
          <span>{toast.message}</span>
          <button aria-label="关闭提示" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      {help && (
        <Modal title="学习指南" onClose={() => setHelp(false)}>
          <div className="guide">
            <h3>先看任务，再开始学习</h3>
            <p>“我的任务”展示企业安排的课程和截止日期，按顺序的任务需要完成前一阶段才能继续。</p>
            <h3>学习与训练</h3>
            <p>学习页面完成每个课时后保存进度。训练可以提交文字练习，结束后等待评价。</p>
            <h3>考试与记录</h3>
            <p>
              考试开始后按服务端时间计时，答案自动保存；到时提交。可在个人中心查看成绩、训练复盘和成长记录。
            </p>
            <h3>ola</h3>
            <p>检索企业课程和知识原文，并按会话保存查询记录。当前智能生成及语音评分服务尚未开通。</p>
          </div>
        </Modal>
      )}
      {confirmLogout && (
        <Modal
          title="退出学习中心"
          onClose={() => setConfirmLogout(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmLogout(false)}>
                取消
              </button>
              <button
                className="btn primary"
                onClick={() =>
                  void run(async () => {
                    if(!allowLeaving())return;
                    await api.logout();
                    onLogout();
                  })
                }
              >
                退出登录
              </button>
            </>
          }
        >
          <p>已保存的学习记录将保留。如果正在答题，请先确认答案已保存。</p>
        </Modal>
      )}
    </PortalContext.Provider>
  );
}
