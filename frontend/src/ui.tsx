import { randomId } from '../../shared/random-id.ts';
import {
  navigateHash,
  prepareHistoryBack,
  watchHashRoute,
} from "../../shared/navigation-guard";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Bot,
  Box,
  NotebookText,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Home as HomeIcon,
  ListChecks,
  MessageCircle,
  UserRound,
} from "lucide-react";
import type {
  Course as BusinessCourse,
  Overview,
} from "@ola/learner-client/types";
import { percent } from "./domain";
export const asset = (name: string) => `/assets/${name}`;
export type Course = BusinessCourse & {
  progress: number;
  count: number;
  badge?: string;
};
export const displayCourse = (
  course: BusinessCourse,
  data: Overview,
): Course => ({
  ...course,
  progress: percent(course, data),
  count:
    course.kind === "exam" ? course.questionCount || 0 : course.lessons.length,
  badge:
    percent(course, data) === 100
      ? "已完成"
      : percent(course, data) > 0
        ? "学习中"
        : undefined,
});
export type MainTab = "home" | "courses" | "whale" | "tasks" | "my";
type Message = { side: "me" | "ai"; text: string; time: string };
const mainTabs: { id: MainTab; label: string; Icon: typeof HomeIcon }[] = [
  { id: "home", label: "首页", Icon: Box },
  { id: "courses", label: "课程", Icon: NotebookText },
  { id: "whale", label: "ola", Icon: MessageCircle },
  { id: "tasks", label: "任务", Icon: ListChecks },
  { id: "my", label: "我的", Icon: UserRound },
];
const initials = { learn: "学习", train: "训练", exam: "考试" };
const courseAction = { learn: "开始学习", train: "开始训练", exam: "开始考试" };
export function useRoute() {
  const [route, setRoute] = useState(
    location.hash.replace(/^#/, "") || "/home",
  );
  useEffect(() => watchHashRoute(setRoute), []);
  const go = (path: string) => {
    if (navigateHash(path)) window.scrollTo(0, 0);
  };
  const back = () => {
    if (window.olaTrainingReceive) {
      window.olaTrainingReceive({
        version: 1,
        requestId: randomId(),
        type: "back",
      });
      return;
    }
    if (history.length > 1) {
      if (prepareHistoryBack()) history.back();
    } else go("/home");
  };
  const [path, query = ""] = route.split("?");
  return { path, params: new URLSearchParams(query), go, back };
}

export function Progress({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return (
    <div className={`progress ${className}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {action &&
        (onAction ? (
          <button onClick={onAction}>
            {action}
            <ChevronRight size={16} />
          </button>
        ) : (
          <span className="section-note">{action}</span>
        ))}
    </div>
  );
}
export function Topbar({
  title,
  back,
  action,
}: {
  title: string;
  back: () => void;
  action?: React.ReactNode;
}) {
  return (
    <header className="topbar">
      <button aria-label="返回" className="icon-button" onClick={back}>
        <ArrowLeft size={23} />
      </button>
      <strong>{title}</strong>
      <div className="topbar-action">{action}</div>
    </header>
  );
}
export function BottomNav({
  active,
  go,
}: {
  active: MainTab;
  go: (route: string) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {mainTabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={active === id ? "active" : ""}
          aria-current={active === id ? "page" : undefined}
          onClick={() => go(`/${id}`)}
        >
          {id === "whale" ? (
            <img className="ola-nav-icon" src="/assets/ola-app-icon.png" alt="" />
          ) : (
            <Icon size={23} strokeWidth={active === id ? 2.4 : 1.8} />
          )}
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
export function Page({
  children,
  tab,
  go,
  className = "",
}: {
  children: React.ReactNode;
  tab?: MainTab;
  go: (route: string) => void;
  className?: string;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!document.querySelector('[aria-modal="true"],dialog[open]'))
      pageRef.current?.focus({preventScroll:true});
  }, [tab]);
  return (
    <div ref={pageRef} tabIndex={-1} role="region" aria-label={mainTabs.find(item=>item.id===tab)?.label||'页面内容'} className={`page ${tab ? "has-nav" : ""} ${className}`}>
      {children}
      {tab && <BottomNav active={tab} go={go} />}
    </div>
  );
}
export function FixedAction({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <footer className="fixed-action">
      <button className="primary-button" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    </footer>
  );
}
export function Empty({
  title,
  hint,
  action,
  onAction,
}: {
  title: string;
  hint: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <CheckCircle2 size={34} />
      <strong>{title}</strong>
      <p>{hint}</p>
      {action && <button onClick={onAction}>{action}</button>}
    </div>
  );
}

export function CourseCard({
  course,
  onClick,
}: {
  course: Course;
  onClick: () => void;
}) {
  return (
    <button className="course-card" onClick={onClick}>
      <div className="course-cover">
        <img className="cover-back" src={course.cover} alt="" onError={courseImageFallback}/>
        <img className="cover-front" src={course.cover} alt="" onError={courseImageFallback}/>
        {course.badge && <span className="cover-tag">{course.badge}</span>}
      </div>
      <div className="course-card-body">
        <strong>{course.title}</strong>
        <p>{course.summary}</p>
        <div className="course-card-meta">
          <span>
            {course.kind === 'train' ? course.trainingMode : course.progress
              ? `${course.progress}% 已完成`
              : `${course.count} ${course.kind === "exam" ? "道试题" : "个课时"}`}
          </span>
          <span>
            <Clock3 size={13} />
            {course.kind === "exam" ? course.examMinutes : course.duration} 分钟
          </span>
        </div>
      </div>
    </button>
  );
}
export function courseImageFallback(event:React.SyntheticEvent<HTMLImageElement>){
  const image=event.currentTarget;
  if(!image.src.endsWith('/assets/course-communication.webp'))image.src=asset('course-communication.webp');
}
export function Recommendation({
  course,
  go,
}: {
  course: Course;
  go: (route: string) => void;
}) {
  return (
    <button
      className="recommendation"
        onClick={() => go(`/${course.kind==='learn'&&course.progress<100?'content':'course'}/${course.id}?v=${course.version}`)}
    >
      <div>
        <span className="eyebrow">为你推荐</span>
        <strong>{course.title}</strong>
        <p>{course.kind==='learn'&&course.progress?course.progress===100?'回顾课程要点，巩固学习成果':'接着上次的进度，继续学习':'从这门课程开始，逐步提升岗位能力'}</p>
        <small>
          <Clock3 size={15} />约 {course.kind === "exam" ? course.examMinutes : course.duration} 分钟 · {course.kind==='train'?course.trainingMode:`${course.count} ${course.kind==='exam'?'道试题':'个课时'}`}
        </small>
      </div>
      <img src={asset("home-resume-hero.webp")} alt="" />
      <span className="recommendation-cta">
        {course.kind==='learn'&&course.progress?course.progress===100?'复习课程':'继续学习':courseAction[course.kind]}
        <ChevronRight size={17} />
      </span>
    </button>
  );
}
