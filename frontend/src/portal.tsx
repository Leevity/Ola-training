import {
  allowLeaving,
  navigateHash,
  prepareHistoryBack,
} from "../../shared/navigation-guard";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as api from "@ola/learner-client";
import type { Overview, User, Tenant } from "@ola/learner-client/types";
import { installAppBridge } from "./app-bridge";
import {watchLearningRefresh} from '../../shared/learner-refresh';
import {Context,type Portal,type Session} from './portal-context';
export {usePortal} from './portal-context';
export function useRemote<T>(load: () => Promise<T>, deps: unknown[]) {
  const [value, setValue] = useState<T | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setValue(null);
    setError("");
    load()
      .then((v) => {
        if (active) setValue(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [...deps, revision]);
  return { value, error, retry: () => setRevision((v) => v + 1) };
}
export function Loading() {
  return (
    <div className="mobile-loading" role="status">
      <span />
      正在加载…
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="mobile-error" role="alert">
      <p>{message}</p>
      {retry && (
        <button className="primary-button" onClick={retry}>
          重试
        </button>
      )}
    </div>
  );
}
export function PortalProvider({ children }: { children: ReactNode }) {
  const overviewRequest=useRef(0);
  const sessionChanging=useRef(false);
  const [session, setSession] = useState<Session | null>(null),
    [data, setData] = useState<Overview | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const loadOverview=async()=>{
    const request=++overviewRequest.current;
    const next=await api.overview();
    if(request===overviewRequest.current)setData(next);
    return next;
  };
  const connect = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.me();
      setSession(result);
      await loadOverview();
    } catch (e) {
      if (e instanceof api.ApiError && e.status === 401) {
        setSession(null);
        setData(null);
      } else setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void connect();
    const expired = () => {
      overviewRequest.current++;
      setSession(null);
      setData(null);
    };
    addEventListener("ola:expired", expired);
    return () => removeEventListener("ola:expired", expired);
  }, []);
  useEffect(()=>{
    if(!session)return;
    return watchLearningRefresh(()=>sessionChanging.current?Promise.resolve():loadOverview(),()=>setToast('学习数据同步失败，可在账号设置中重试刷新'));
  },[session?.user.id,session?.user.tenantId]);
  useEffect(
    () =>
      installAppBridge({
        navigate: navigateHash,
        beforeBack: prepareHistoryBack,
        refresh: async()=>{await loadOverview();},
        logout: async () => {
          if (!allowLeaving()) throw new Error("已取消退出");
          await api.logout();
          setSession(null);
          setData(null);
        },
      }),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  if (loading)
    return (
      <div className="app-shell">
        <Loading />
      </div>
    );
  if (error)
    return (
      <div className="app-shell">
        <ErrorState message={error} retry={() => void connect()} />
      </div>
    );
  if (!session) return <Login onLogin={connect} />;
  if (!data)
    return (
      <div className="app-shell">
        <Loading />
      </div>
    );
  const value: Portal = {
    session,
    data,
    refresh: loadOverview,
    notify: setToast,
    logout: async () => {
      if (!allowLeaving()) return;
      sessionChanging.current=true;overviewRequest.current++;
      try{await api.logout();setSession(null);setData(null);}finally{sessionChanging.current=false;}
    },
    changeTenant: async (id) => {
      if (!allowLeaving()) return;
      sessionChanging.current=true;overviewRequest.current++;setLoading(true);
      try{await api.switchTenant(id);await connect();location.hash='/home';}finally{sessionChanging.current=false;setLoading(false);}
    },
  };
  return (
    <Context.Provider
      key={`${session.user.id}:${session.user.tenantId}`}
      value={value}
    >
      <div className="app-shell">
        {children}
        {toast && (
          <div className="mobile-toast" role="status">
            {toast}
          </div>
        )}
      </div>
    </Context.Provider>
  );
}
function Login({ onLogin }: { onLogin: () => Promise<void> }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="app-shell mobile-login">
      <div className="brand">
        <span className="brand-mark"><img src="/assets/ola-app-icon.png" alt="" /></span>
        <strong>
          ola<span>-training</span>
        </strong>
      </div>
      <h1>登录学习空间</h1>
      <p>学习记录在电脑和手机间同步</p>
      <form
        className="mobile-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api.login(email, password);
            await onLogin();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          邮箱
          <input
            required
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          密码
          <input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <ErrorState message={error} />}
        <button className="primary-button" disabled={busy}>
          {busy ? "正在登录…" : "登录"}
        </button>
      </form>
      <p className="muted">账号由所在企业管理员开通</p>
    </div>
  );
}
