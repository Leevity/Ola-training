import { randomId } from '../../shared/random-id.ts';
import { ClassroomLoading } from '@ola/classroom-ui/loading';
import {returnDestination} from '../../shared/learner-navigation';
import {registerLeaveGuard,protectUnsaved} from '../../shared/navigation-guard';
import { lazy, Suspense } from 'react';
const ClassroomLesson=lazy(()=>import('./classroom-lesson').then(module=>({default:module.ClassroomLesson})));
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  CircleAlert,
  ChevronRight,
  Clock3,
  FileText,
  Flag,
  Headphones,
  Lightbulb,
  Loader2,
  MessageCircle,
  Play,
  Printer,
  Send,
  ShieldCheck,
  Square,
  Volume2,
} from 'lucide-react';
import * as api from './api';
import { usePortal, useRemote } from './context';
import type { Attempt, Course, Question, Training } from './types';
import { dateTime, key, percent, safeVideo, secondsLeft, firstIncompleteLesson, examEntry } from './domain';
import { Empty, ErrorState, Loading, Modal, PageTitle, ProgressBar } from './ui';

function DocumentBody({ text }: { text: string }) {
  return (
    <div className="document-body">
      {text.split('\n').map((line, index) =>
        line.startsWith('### ') ? (
          <h3 key={index}>{line.slice(4)}</h3>
        ) : line.startsWith('## ') ? (
          <h2 key={index}>{line.slice(3)}</h2>
        ) : line.startsWith('# ') ? (
          <h2 key={index}>{line.slice(2)}</h2>
        ) : line.startsWith('- ') ? (
          <p className="document-bullet" key={index}>
            {line.slice(2)}
          </p>
        ) : (
          <p key={index}>{line || '\u00a0'}</p>
        ),
      )}
    </div>
  );
}
export function StudyPage({ id, version }: { id: string; version: number }) {
  const { data, go, refresh, notify } = usePortal();
  const v = version || data.courses.find((c) => c.id === id)?.version || 1;
  const remote = useRemote(() => api.course(id, v), [id, v]);
  const [index, setIndex] = useState(0),
    [busy, setBusy] = useState(false),
    [finished, setFinished] = useState(false);
  const [classroomReady,setClassroomReady]=useState(false);
  const [activityComplete,setActivityComplete]=useState(true);
  const [activityHint,setActivityHint]=useState('');
  const [outlineExpanded,setOutlineExpanded]=useState(false);
  const events = useRef(new Map<string, string>());
  useEffect(() => {
    if (!remote.value) return;
    const parameter = new URLSearchParams(location.hash.split('?')[1] || '').get('lesson');
    const first = remote.value.lessons.findIndex(
      (l) => !data.progress.some((p) => p.courseId === id && p.version === v && p.lessonId === l.id),
    );
    setIndex(
      parameter !== null
        ? Math.max(0, Math.min(remote.value.lessons.length - 1, Number(parameter) || 0))
        : Math.max(0, first),
    );
  }, [remote.value]);
  if (remote.error) return <ErrorState message={remote.error} retry={remote.retry} />;
  if (!remote.value) return <Loading />;
  const c = remote.value;
  if (c.kind !== 'learn' || !c.lessons.length)
    return (
      <Empty
        title="暂无学习内容"
        hint="请联系管理员完善课程"
        action="返回课程"
        onAction={() => go(`/course/${id}?v=${v}`)}
      />
    );
  const lesson = c.lessons[index] || c.lessons[0];
  const done = (lessonId: string) =>
    data.progress.some((p) => p.courseId === id && p.version === v && p.lessonId === lessonId);
  const complete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let event = events.current.get(lesson.id);
      if (!event) {
        event = randomId();
        events.current.set(lesson.id, event);
      }
      await api.complete(c, lesson.id, event);
      const saved=await refresh();
      notify('课时进度已保存');
      const missing=firstIncompleteLesson(c,saved);
      if (missing>=0) {
        setClassroomReady(false);
        setIndex(missing);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else setFinished(true);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const nextTask = data.tasks.find((t) => t.snapshot.some((s) => s.id === id && s.version === v));
  return (
    <>
      <PageTitle
        title={c.title}
        description={`${c.category} · 第 ${index + 1} / ${c.lessons.length} 课时`}
        back={() => go(returnDestination(location.hash,`/course/${id}?v=${v}`))}
      >
        <span className="badge blue">课程学习</span>
      </PageTitle>
      <div className="study-layout">
        <aside className={`study-directory ${outlineExpanded?'expanded':''}`}>
          <div className="study-directory-heading"><h3>课程目录</h3><button className="btn study-directory-toggle" aria-expanded={outlineExpanded} aria-controls="course-lesson-navigation" onClick={()=>setOutlineExpanded(value=>!value)}>{outlineExpanded?'收起目录':'展开目录'}<ChevronRight size={16}/></button></div>
          <p>
            {c.lessons.filter((l) => done(l.id)).length}/{c.lessons.length} 课时已完成
          </p>
          <ProgressBar value={percent(c, data)} />
          <nav id="course-lesson-navigation" aria-label="课时目录">
            {c.lessons.map((l, i) => (
              <button
                key={l.id}
                className={index === i ? 'selected' : ''}
                disabled={busy||(lesson.format==='AI课堂'&&!classroomReady)}
                onClick={() => {
                  if(i===index&&!finished){setOutlineExpanded(false);return;}
                  setClassroomReady(false);
                  setIndex(i);
                  setFinished(false);
                  setOutlineExpanded(false);
                }}
              >
                <span>{done(l.id) ? <CheckCircle2 size={17} /> : String(i + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{l.title}</strong>
                  <small>{l.format}</small>
                </div>
                {index === i && <Play size={13} fill="currentColor" />}
              </button>
            ))}
          </nav>
          <div className="notice">
            <ShieldCheck size={17} />
            完成每个课时后，进度会保存到你的学习档案。
          </div>
        </aside>
        <section className={`study-document ${lesson.format==='AI课堂'?'classroom-document':''}`}>
          <div className="document-header">
            <span className="eyebrow">LESSON {String(index + 1).padStart(2, '0')}</span>
            <h1>{lesson.title}</h1>
            <span>
              <FileText size={14} />
              {lesson.format}
              {done(lesson.id) && (
                <em>
                  <Check size={13} />
                  已完成
                </em>
              )}
            </span>
          </div>
          {finished ? (
            <div className="completion-panel">
              <CheckCircle2 size={58} />
              <h2>本门课程学习完成</h2>
              <p>所有课时的学习记录已保存，可查看任务或复习课程。</p>
              <div>
                <button className="btn" onClick={() => go('/growth')}>
                  评价课程
                </button>
                <button
                  className="btn primary"
                  onClick={() => go(nextTask ? '/task/' + nextTask.id : '/courses')}
                >
                  {nextTask ? '返回任务详情' : '继续浏览课程'}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : lesson.format === 'AI课堂' ? (
            <Suspense fallback={<ClassroomLoading/>}><ClassroomLesson key={lesson.id} courseId={c.id} version={v} sceneId={lesson.content} scene={c.classroom?.scenes.find((scene:any)=>scene.id===lesson.content)} onReadyChange={setClassroomReady} onCompletionChange={(complete,hint)=>{setActivityComplete(complete);setActivityHint(hint);}}/></Suspense>
          ) : lesson.format === '视频链接' ? (
            <div className="video-content">
              {safeVideo(lesson.content) ? (
                <>
                  <video key={lesson.id} controls preload="metadata" poster={c.cover}>
                    <source src={safeVideo(lesson.content)!} />
                    你的浏览器不支持视频播放。
                  </video>
                  <p className="muted">若链接为外部播放页面，请在新窗口打开学习。</p>
                  <a
                    className="btn"
                    href={safeVideo(lesson.content)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    打开视频链接
                    <ArrowRight size={16} />
                  </a>
                </>
              ) : (
                <div className="error-note">视频地址无效，请联系管理员更新。</div>
              )}
            </div>
          ) : (
            <DocumentBody text={lesson.content} />
          )}
          <footer className="study-actions">
            <button
              className="btn"
              disabled={index === 0 || busy || (lesson.format==='AI课堂'&&!classroomReady)}
              onClick={() => {
                setClassroomReady(false);
                setIndex((i) => i - 1);
                setFinished(false);
              }}
            >
              <ArrowLeft size={16} />
              上一课时
            </button>
            <span>{done(lesson.id) ? '本课时已完成' :lesson.format==='AI课堂'&&!activityComplete?activityHint:'学习结束后，请确认完成本课时'}</span>
            <button
              className="btn primary"
              disabled={busy || finished || (lesson.format==='AI课堂'&&(!classroomReady||!activityComplete)) || (lesson.format === '视频链接' && !safeVideo(lesson.content))}
              onClick={() => void complete()}
            >
              {busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />}{' '}
              {busy ? '正在保存' : index === c.lessons.length - 1 ? '完成学习' : '完成本课时，继续下一课时'}
            </button>
          </footer>
        </section>
      </div>
    </>
  );
}
const questionLabels = {
  single: '单选题',
  multiple: '多选题',
  boolean: '判断题',
  fill: '填空题',
  text: '问答题',
};
export function ExamPage({ id }: { id: string }) {
  const { data, go, refresh, notify } = usePortal();
  const [attempt, setAttempt] = useState<Attempt | null>(null),
    [error, setError] = useState(''),
    [index, setIndex] = useState(0),
    [answers, setAnswers] = useState<Attempt['answers']>({}),
    [saveStatus, setSaveStatus] = useState('答案已同步'),
    [saveError, setSaveError] = useState(''),
    [submitError,setSubmitError]=useState(''),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now());
  const writer=useRef<api.ExamAnswerWriter|null>(null);
  const answersRef = useRef<Attempt['answers']>({});
  const revision = useRef(0),
    savedRevision = useRef(0),
    queue = useRef(Promise.resolve()),
    activeRef = useRef(false),
    submitting = useRef(false),
    autoSubmitted = useRef(false),
    serverOffset = useRef(0);
  const latestAttempt = useRef<Attempt | null>(null);
  latestAttempt.current = attempt;
  const load = async () => {
    setError('');
    try {
      await queue.current.catch(()=>{});
      const a = await api.attempt(id);
      writer.current=new api.ExamAnswerWriter(a.answersRevision,(value,rev)=>api.saveAnswers(id,value,rev));
      revision.current=0;savedRevision.current=0;setSaveError('');setSubmitError('');setSaveStatus('答案已同步');
      setAttempt(a);
      answersRef.current = a.answers;
      setAnswers(a.answers);
      activeRef.current = a.status === 'active';
      if (a.serverNow) serverOffset.current = Date.parse(a.serverNow) - Date.now();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void load();
  }, [id]);
  const summary=data.attempts.find(a=>a.id===id);
  useEffect(()=>{if(summary?.status==='graded'&&attempt?.status==='pending_review')void load();},[summary?.status,summary?.score,attempt?.status]);
  const save = async () => {
    if (!activeRef.current || savedRevision.current >= revision.current) return;
    const snapshot = structuredClone(answersRef.current),
      rev = revision.current;
    const work = queue.current
      .catch(() => {})
      .then(async () => {
        await writer.current!.save(snapshot);
        savedRevision.current = Math.max(savedRevision.current, rev);
        if (revision.current === rev) {
          setSaveStatus('答案已保存');
          setSaveError('');
        }
      });
    queue.current = work;
    try {
      await work;
    } catch (e) {
      setSaveError((e as Error).message);
      setSaveStatus(writer.current?.locked?'保存冲突，请加载服务端答卷':'保存失败，请重试');
      throw e;
    }
  };
  useEffect(() => {
    if (!attempt || attempt.status !== 'active' || revision.current === 0) return;
    const timer = setTimeout(() => {
      void save().catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [answers, attempt?.status]);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    const before = (e: BeforeUnloadEvent) => {
      if (activeRef.current && revision.current > savedRevision.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    const removeGuard=registerLeaveGuard(()=>{if(!activeRef.current||revision.current<=savedRevision.current)return true;void save().catch(()=>{});return window.confirm('还有未保存的考试答案。离开可能丢失当前更改，考试计时仍会继续。确认离开？');});
    window.addEventListener('beforeunload', before);
    return () => {
      clearInterval(interval);
      removeGuard();
      window.removeEventListener('beforeunload', before);
      if (activeRef.current && revision.current > savedRevision.current) void save().catch(() => {});
    };
  }, []);
  const submit = async (expired = false) => {
    if (submitting.current) return;
    expired=expired||!!latestAttempt.current&&secondsLeft(latestAttempt.current.expiresAt,Date.now()+serverOffset.current)===0;
    submitting.current = true;
    setSubmitError('');
    setBusy(true);
    setConfirm(false);
    try {
      if (!expired) await save();
      else await queue.current.catch(() => {});
      const a = await api.submitExam(id, expired ? undefined : answersRef.current,writer.current?.revision);
      activeRef.current = false;
      setAttempt(a);
      setAnswers(a.answers);
      await refresh();
      notify(expired ? '考试时间已结束，已提交保存的答案' : '答卷已提交');
    } catch (e) {
      // A lost HTTP response does not prove that the server rejected the submission.
      if((e as {status?:number})?.status===0){
        try{
          const confirmed=await api.attempt(id);
          if(confirmed.status!=='active'){
            activeRef.current=false;setAttempt(confirmed);setAnswers(confirmed.answers);
            await refresh().catch(()=>{});notify('已从服务端确认交卷结果');return;
          }
        }catch{/* Keep the original failure and explicit retry when confirmation is unavailable. */}
      }
      writer.current?.lockOnConflict(e);
      if(writer.current?.locked)setSaveStatus('答卷有更新，请先加载服务端答卷');
      setSubmitError((e as Error)?.message || '交卷未完成，请检查连接后重试。');
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  };
  const remaining = attempt ? secondsLeft(attempt.expiresAt, now + serverOffset.current) : 0;
  useEffect(() => {
    if (attempt?.status === 'active' && remaining === 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submit(true);
    }
  }, [remaining, attempt?.status]);
  if (error) return <ErrorState message={error} retry={() => void load()} />;
  if (!attempt) return <Loading text="正在恢复答卷" />;
  const resultCourse=data.courses.find(c=>c.id===attempt.courseId&&c.version===attempt.version);
  const quotaSpent=resultCourse?examEntry(resultCourse,data).exhausted:false;
  const courseTitle =
    data.attempts.find((a) => a.id === id)?.title ||
    data.courses.find((c) => c.id === attempt.courseId)?.title ||
    '课程考试';
  const qs = attempt.paper.questions;
  const done = qs.filter((q) => (answers[q.id] || []).some((a) => a.trim())).length;
  if (attempt.status !== 'active')
    return (
      <>
        <PageTitle title={courseTitle} description="考试结果与作答回顾" back={() => go(returnDestination(location.hash,'/history'))}>
          <button className="btn" onClick={() => window.print()}>
            <Printer size={16} />
            打印结果
          </button>
        </PageTitle>
        <section
          className={
            'exam-result ' +
            (attempt.status === 'pending_review' ? 'pending' : attempt.passed ? 'passed' : 'failed')
          }
        >
          <span className="result-icon">
            {attempt.status === 'pending_review' ? <Clock3 size={40} /> : attempt.passed ? <CheckCircle2 size={40} /> : <CircleAlert size={40} />}
          </span>
          <div>
            <span className="eyebrow">
              {attempt.status === 'pending_review' ? '主观题待阅卷' : '本次考试成绩'}
            </span>
            <h1>
              {attempt.status === 'pending_review' ? '待定' : attempt.score ?? '—'}
              <small>{attempt.status === 'pending_review' ? '最终成绩' : '/ 100 分'}</small>
            </h1>
            <p>
              {attempt.status === 'pending_review'
                ? `客观题已得 ${attempt.score ?? '—'} 分，主观题阅卷后公布最终成绩。`
                : attempt.passed
                  ? '恭喜你，通过本次考试'
                  : quotaSpent?'本版本考试次数已用完，可回顾答卷巩固知识。':'继续巩固知识，为下一次考试做好准备。'}
            </p>
          </div>
          <span className="result-status">
            {attempt.status === 'pending_review' ? '待阅卷' : attempt.passed ? '已通过' : '未通过'}
          </span>
        </section>
        <div className="result-details">
          <span>
            合格分数 <strong>{attempt.paper.passScore} 分</strong>
          </span>
          <span>
            作答题数{' '}
            <strong>
              {done}/{qs.length}
            </strong>
          </span>
          <span>
            考试开始 <strong>{dateTime(attempt.startedAt)}</strong>
          </span>
          <button
            className="btn primary"
            onClick={() => go(`/course/${attempt.courseId}?v=${attempt.version}`)}
          >
            返回课程
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="section-head section-space">
          <h2>作答回顾</h2>
          <span>标准答案由企业管理</span>
        </div>
        <div className="answer-review">
          {qs.map((q, i) => (
            <article key={q.id}>
              <span className="badge blue">{questionLabels[q.type]}</span>
              <h3>
                {i + 1}. {q.title}
              </h3>
              <p>
                我的答案：
                {(answers[q.id] || []).map((a) => q.options.find((o) => o.id === a)?.text || a).join('；') ||
                  '未作答'}
              </p>
              <small>{q.points} 分</small>
            </article>
          ))}
        </div>
      </>
    );
  const q = qs[index],
    selected = answers[q.id] || [];
  const choose = (value: string) => {
    if (remaining === 0 || busy || writer.current?.locked) return;
    const picked =
      q.type === 'multiple'
        ? selected.includes(value)
          ? selected.filter((s) => s !== value)
          : [...selected, value]
        : [value];
    const next = { ...answersRef.current, [q.id]: picked };
    answersRef.current = next;
    revision.current++;
    setAnswers(next);
    setSaveStatus('正在保存…');
  };
  return (
    <>
      <PageTitle title={courseTitle} description="请独立完成作答，考试开始后不会暂停计时。" />
      <div className="exam-toolbar">
        <span>
          <FileText size={18} />
          已答 <b>{done}</b>/{qs.length} 题
        </span>
        <div className={remaining < 300 ? 'timer danger-text' : 'timer'}>
          <Clock3 size={18} />
          剩余时间{' '}
          <b>
            {String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}
          </b>
        </div>
        <span className={saveError ? 'danger-text' : 'save-state'}>{saveStatus}</span>
      </div>
      {(saveError||submitError) && (
        <div className="error-note" role="alert">
          {submitError||saveError}
          <button className="text-btn" disabled={busy} onClick={() => writer.current?.locked?void load():submitError?void submit(remaining===0):void save().catch(() => {})}>
            {writer.current?.locked?'放弃本地更改并加载服务端答卷':submitError?remaining===0?'重新提交已保存的答案':'重试交卷':'重试保存'}
          </button>
        </div>
      )}
      {remaining===0&&<p className="notice" role="status">{busy?'考试时间已结束，正在提交已保存的答案。':'考试时间已结束，不能继续修改。请确认已保存的答案提交成功。'}</p>}
      <div className="exam-layout">
        <section className="question-panel">
          <div className="question-meta">
            <span className="badge blue">{questionLabels[q.type]}</span>
            <span>{q.points} 分</span>
            <span>
              第 {index + 1} / {qs.length} 题
            </span>
          </div>
          <h2>{q.title}</h2>
          <p className="muted">
            {q.type === 'multiple'
              ? '请选择所有符合要求的选项'
              : q.type === 'single' || q.type === 'boolean'
                ? '请选择一个答案'
                : '请在下方填写答案'}
          </p>
          <fieldset disabled={busy || remaining === 0 || writer.current?.locked} className="answer-options">
            <legend className="sr-only">{q.title}</legend>
            {['single', 'multiple', 'boolean'].includes(q.type) ? (
              q.options.map((o) => (
                <label key={o.id} className={selected.includes(o.id) ? 'selected' : ''}>
                  <input
                    type={q.type === 'multiple' ? 'checkbox' : 'radio'}
                    name={q.id}
                    checked={selected.includes(o.id)}
                    onChange={() => choose(o.id)}
                  />
                  <span className="option-letter">{o.id}</span>
                  <span>{o.text}</span>
                  {selected.includes(o.id) && <CheckCircle2 size={19} />}
                </label>
              ))
            ) : q.type === 'fill' ? (
              <input
                className="fill-answer"
                aria-label="填空答案"
                value={selected[0] || ''}
                maxLength={10000}
                onChange={(e) => choose(e.target.value)}
                placeholder="请输入你的答案"
              />
            ) : (
              <textarea
                aria-label="问答题答案"
                rows={8}
                maxLength={10000}
                value={selected[0] || ''}
                onChange={(e) => choose(e.target.value)}
                placeholder="请结合所学内容作答"
              />
            )}
          </fieldset>
          <div className="question-navigation">
            <button className="btn" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              <ArrowLeft size={16} />
              上一题
            </button>
            <span>
              {index + 1} / {qs.length}
            </span>
            <button className="btn" disabled={index === qs.length - 1} onClick={() => setIndex((i) => i + 1)}>
              下一题
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
        <aside className="answer-sheet">
          <h3>答题卡</h3>
          <p>点击题号跳转，可随时修改答案</p>
          <div>
            {qs.map((question, i) => (
              <button
                key={question.id}
                aria-label={`跳转第${i + 1}题`}
                aria-current={index === i ? 'step' : undefined}
                className={(answers[question.id] || []).some((v) => v.trim()) ? 'answered' : ''}
                onClick={() => setIndex(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p className="sheet-legend">
            <i />
            已作答 <i />
            未作答
          </p>
          <button className="btn primary full" disabled={busy||writer.current?.locked} onClick={() => setConfirm(true)}>
            {busy ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}{' '}
            {busy ? '正在提交' : '提交答卷'}
          </button>
          <small>到时将自动提交已保存的答案。请留意保存状态。</small>
        </aside>
      </div>
      {confirm && (
        <Modal
          title="确认提交答卷"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(false)}>
                继续作答
              </button>
              <button className="btn primary" onClick={() => void submit(remaining === 0)}>
                确认提交
              </button>
            </>
          }
        >
          <p>
            已完成 <strong>{done}</strong> / {qs.length} 题。
            {done < qs.length && <span className="danger-text">还有 {qs.length - done} 题未作答。</span>}
          </p>
          <p>提交后将结束本次考试，无法继续修改答案。</p>
        </Modal>
      )}
    </>
  );
}
export function TrainingPage({ id }: { id: string }) {
  const { data, go, refresh, notify } = usePortal();
  const remote = useRemote(() => api.training(id), [id]);
  const [course, setCourse] = useState<Course | null>(null),
    [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [hints, setHints] = useState(false),
    [perspective, setPerspective] = useState('顾问'),
    [now, setNow] = useState(Date.now()),
    [speaking, setSpeaking] = useState(false),
    [round, setRound] = useState(0);
  const draftText=useRef(text);draftText.current=text;
  useEffect(()=>protectUnsaved(()=>Boolean(draftText.current.trim()),'训练表达尚未保存，离开可能丢失内容。请先保存表达或结束训练，仍要离开？'),[]);
  const messageId = useRef(randomId());
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (remote.value) {
      const s = remote.value.session;
      void api
        .course(s.course_id, s.course_version)
        .then(setCourse)
        .catch(() => {});
    }
  }, [remote.value?.session.id]);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(tick);
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [remote.value?.messages.length]);
  if (remote.error) return <ErrorState message={remote.error} retry={remote.retry} />;
  if (!remote.value) return <Loading />;
  const t = remote.value,
    s = t.session,
    title = t.course?.title || data.training.find((t) => t.id === id)?.title || course?.title || '场景训练';
  if (s.status !== 'active') return <RecapPage id={id} />;
  const elapsed = Math.max(0, Math.floor((now - Date.parse(s.created_at)) / 60000));
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await api.sendTraining(id, `[${perspective}] ${text.trim()}`, messageId.current);
      remote.setValue(await api.training(id));
      setText('');
      messageId.current = randomId();
      draftText.current='';
      notify('练习内容已保存');
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const finish = async () => {
    setBusy(true);
    try {
      await api.finishTraining(id,text.trim()?{id:messageId.current,text:`[${perspective}] ${text.trim()}`}:undefined);
      draftText.current='';setText('');
      await refresh();
      go('/recap/' + id);
    } catch (e) {
      notify((e as Error).message, true);
      setBusy(false);
    }
  };
  const reference =
    course?.lessons[round]?.content || course?.objective || '请先了解客户的使用场景，再复述并确认需求。';
  const speak = () => {
    if (!('speechSynthesis' in window)) {
      notify('当前浏览器不支持朗读，请阅读参考内容', true);
      return;
    }
    if (speaking) {
      speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(reference);
    utterance.lang = 'zh-CN';
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      notify('朗读暂不可用，请阅读参考内容', true);
    };
    setSpeaking(true);
    speechSynthesis.speak(utterance);
  };
  return (
    <>
      <PageTitle
        title={title}
        description={`${course?.trainingMode || '场景练习'} · 本次已练习 ${elapsed} 分钟`}
        back={() => go(returnDestination(location.hash,'/history'))}
      >
        <button className="btn" disabled={busy} onClick={() => setConfirm(true)}>
          <Flag size={16} />
          结束训练
        </button>
      </PageTitle>
      <div className="training-layout">
        <aside className="training-scenario">
          <span className="eyebrow">训练场景</span>
          <img src="/assets/role-a.png" alt="模拟客户角色" />
          <h2>{course?.role || '客户沟通练习'}</h2>
          <span className="badge blue">{course?.trainingMode || '文字练习'}</span>
          <h3>训练目标</h3>
          <p>{course?.objective || '围绕企业设置的目标进行练习。'}</p>
          <h3>当前练习角色</h3>
          <div className="segmented">
            {['顾问', '客户'].map((role) => (
              <button
                key={role}
                className={perspective === role ? 'selected' : ''}
                disabled={busy}
                onClick={() => {if(perspective!==role)messageId.current=randomId();setPerspective(role);}}
              >
                {role}
              </button>
            ))}
          </div>
          <small className="muted">角色切换用于整理双方表达，所有内容均标记为你的练习记录。</small>
        </aside>
        <section className="training-conversation">
          <header>
            <span className="online-dot" />
            <strong>文字练习</strong>
            <span>点击保存表达 · 结束时一并保存当前输入</span>
          </header>
          <div className="training-scroll">
            {t.messages.length === 0 && <div className="training-start">
              <span>
                <Headphones size={22} />
              </span>
              <h3>准备好，开始练习吧</h3>
              <p>
                阅读左侧训练目标，输入你的表达或跟读文本。
                <br />
                当前支持记录练习，自动客户对话和语音评分尚未开通。
              </p>
            </div>}
            {t.messages.map((m) => (
              <div className="training-message" key={m.id}>
                <span className="mini-avatar">我</span>
                <div>
                  <span>
                    我的练习 <time>{dateTime(m.created_at)}</time>
                  </span>
                  <p>{m.text}</p>
                  <small>
                    <Check size={12} />
                    已保存
                  </small>
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
          <form className="chat-composer" onSubmit={send}>
            <textarea
              aria-label="训练内容"
              disabled={busy}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                messageId.current = randomId();
              }}
              maxLength={9900}
              rows={3}
              placeholder={
                course?.trainingMode === '跟读训练'
                  ? '阅读或朗读参考话术后，在此记录你的表达…'
                  : course?.trainingMode === '演讲训练'
                    ? '在此记录你的演讲稿或复述内容…'
                    : '试着用自然的语气回应客户，在此输入你的表达…'
              }
            />
            <div>
              <button className="text-btn" type="button" onClick={() => setHints((v) => !v)}>
                <Lightbulb size={16} />
                {hints ? '收起提示' : '查看话术提示'}
              </button>
              <button className="btn primary" disabled={busy || !text.trim()}>
                {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}保存表达
              </button>
            </div>
          </form>
        </section>
        <aside className="training-guide">
          <h3>评价维度</h3>
          <p>{course?.rubric || '按企业配置的评价标准进行练习。'}</p>
          {(hints || course?.trainingMode === '跟读训练') && (
            <div className="training-reference">
              <h3>参考内容</h3>
              {Boolean(course?.lessons.length) && (
                <div className="reference-rounds">
                  <button
                    className="icon-btn"
                    aria-label="上一轮参考"
                    disabled={round === 0}
                    onClick={() => setRound((r) => r - 1)}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <span>
                    第 {round + 1} / {course!.lessons.length} 轮
                  </span>
                  <button
                    className="icon-btn"
                    aria-label="下一轮参考"
                    disabled={round >= course!.lessons.length - 1}
                    onClick={() => setRound((r) => r + 1)}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
              <p>{reference}</p>
              <button className="btn" onClick={speak}>
                {speaking ? <Square size={15} /> : <Volume2 size={16} />}{' '}
                {speaking ? '停止朗读' : '朗读参考内容'}
              </button>
            </div>
          )}
          <div className="notice">
            <ShieldCheck size={18} />
            结束后会生成练习记录，评价由企业管理员完成。
          </div>
          <div className="training-count">
            <strong>{t.messages.length}</strong>
            <span>条已保存表达</span>
          </div>
        </aside>
      </div>
      {confirm && (
        <Modal
          title="结束本次训练"
          onClose={() => !busy && setConfirm(false)}
          footer={
            <>
              <button className="btn" disabled={busy} onClick={() => setConfirm(false)}>
                继续训练
              </button>
              <button className="btn primary" disabled={busy} onClick={() => void finish()}>
                {busy ? '正在提交' : '结束并查看复盘'}
              </button>
            </>
          }
        >
          <p>本次已保存 {t.messages.length} 条表达，结束后进入待评价状态。</p>
          {text.trim() && (
            <div className="error-note">
              输入框中的表达会随结束操作一起保存，保存成功后进入待评价状态。
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
export function RecapPage({ id }: { id: string }) {
  const { data, go, refresh, notify } = usePortal();
  const summary=data.training.find(t=>t.id===id);
  const remote = useRemote(() => api.training(id), [id,summary?.status,summary?.score]);
  const [tab, setTab] = useState('report'),
    [busy, setBusy] = useState(false);
  if (remote.error) return <ErrorState message={remote.error} retry={remote.retry} />;
  if (!remote.value) return <Loading />;
  const t = remote.value,
    s = t.session,
    title = t.course?.title || data.training.find((t) => t.id === id)?.title || '训练复盘';
  const pending = s.status === 'pending_review' || s.status === 'active';
  return (
    <>
      <PageTitle title="训练复盘" description={`${title} · v${s.course_version}`} back={() => go(returnDestination(location.hash,'/history'))}>
        <button className="btn" onClick={remote.retry}>
          刷新评价
        </button>
        <button
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              if (s.status === 'active') go('/training/' + id);
              else {
                const c = await api.course(s.course_id, s.course_version);
                const next = await api.startTraining(c);
                await refresh();
                go('/training/' + next.id);
              }
            } catch (e) {
              notify((e as Error).message, true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {s.status === 'active' ? '继续训练' : '重新训练'}
          <ArrowRight size={16} />
        </button>
      </PageTitle>
      <section className="recap-hero">
        <div>
          <span className="eyebrow">本次训练记录</span>
          <h1>{title}</h1>
          <p>
            {dateTime(s.created_at)} · {t.messages.length} 条练习表达
          </p>
        </div>
        <div className="recap-score">
          <strong>{pending ? '—' : (s.score ?? '—')}</strong>
          <span>{pending ? '等待评价' : s.status === 'completed' ? '已通过' : '未通过'}</span>
        </div>
      </section>
      <div className="large-tabs">
        {[
          ['report', '评价报告'],
          ['dialogue', '话术复盘'],
          ['tips', '训练建议'],
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="recap-body">
        {tab === 'report' ? (
          pending ? (
            <Empty
              title={s.status === 'active' ? '训练还在进行中' : '练习已提交，等待评价'}
              hint="管理员评价后，分数与反馈会同步到这里。可先回顾本次表达。"
              action="查看话术复盘"
              onAction={() => setTab('dialogue')}
            />
          ) : (
            <>
              <h2>训练反馈</h2>
              <p className="feedback-body">{s.evaluation?.feedback || '暂无文字反馈'}</p>
              <div className="notice">本次结果来自企业评价，已保存到个人学习记录。</div>
            </>
          )
        ) : tab === 'dialogue' ? (
          t.messages.length ? (
            <div className="recap-messages">
              {t.messages.map((m, i) => (
                <article key={m.id}>
                  <span>
                    表达 {String(i + 1).padStart(2, '0')} · {dateTime(m.created_at)}
                  </span>
                  <p>{m.text}</p>
                </article>
              ))}
            </div>
          ) : (
            <Empty title="本次没有保存的表达" hint="下次练习时，记得保存你的表达内容" />
          )
        ) : (
          <>
            <h2>为下一次练习做准备</h2>
            <div className="tip-row">
              <span>01</span>
              <div>
                <h3>回顾训练目标</h3>
                <p>对照课程中的评价维度，检查自己的表达是否覆盖关键要求。</p>
              </div>
            </div>
            <div className="tip-row">
              <span>02</span>
              <div>
                <h3>重写一个关键回应</h3>
                <p>从本次练习中选择一条表达，尝试用更简洁、清晰的方式复述。</p>
              </div>
            </div>
            <div className="tip-row">
              <span>03</span>
              <div>
                <h3>参考具体评价</h3>
                <p>{s.evaluation?.feedback || '等待管理员反馈后，再有针对性地完成下一次练习。'}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
