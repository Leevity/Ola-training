import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percent, taskPercent, taskStatus, secondsLeft, safeVideo, nextLearningCourse, learningSummary, firstIncompleteLesson, phaseActivity, examEntry, taskActivityHint, courseEntry } from '../src/domain.ts';
const course = { id: 'c1', version: 2, kind: 'learn', lessons: [{ id: 'one' }, { id: 'two' }] };
test('助手与首页续学直接进入固定版本课堂，训练考试保留规则与评价入口',()=>{
 const state={completed:[],progress:[{courseId:'c1',version:2,lessonId:'one'}],training:[],attempts:[]};
 assert.equal(courseEntry(course,state).href,'/content/c1?v=2');assert.equal(courseEntry(course,state).action,'继续学习');assert.equal(phaseActivity(course,state).href,'/content/c1?v=2');
 assert.equal(courseEntry(course,{...state,progress:[]}).action,'开始学习');
 assert.equal(courseEntry(course,{...state,completed:['c1:2']}).href,'/course/c1?v=2');
 assert.equal(courseEntry({...course,kind:'train'},state).action,'查看训练');
 assert.equal(courseEntry({...course,kind:'exam'},state).action,'查看考试');
 assert.equal(courseEntry({...course,kind:'train'},{...state,training:[{id:'s',courseId:'c1',version:2,status:'pending_review',createdAt:'2026-10-16'}]}).href,'/recap/s');
});
test('任务活动提示说明课时与待评状态，保持整门课程完成口径及顺序边界',()=>{
 const c={id:'c1',version:2,kind:'learn'},task={snapshot:[c],sequential:true};
 const state={completed:[],progress:[{courseId:'c1',version:1,lessonId:'old'},{courseId:'c1',version:2,lessonId:'one'},{courseId:'c1',version:2,lessonId:'one'}],training:[],attempts:[]};
 assert.equal(taskActivityHint(task,state),'1 个课时已完成，可继续学习');assert.equal(taskPercent(task,state),0);
 assert.equal(taskActivityHint(task,{...state,completed:['c1:2']}),'');
 const train={...c,kind:'train'};
 const training=[{id:'s',courseId:'c1',version:2,status:'pending_review',createdAt:'2026-10-16'}];
 assert.equal(taskActivityHint({...task,snapshot:[train]},{...state,training}),'训练已提交，等待管理员评价');
 assert.equal(taskActivityHint({...task,snapshot:[{id:'before',version:1,kind:'learn'},train]},{...state,training}),'');
 assert.equal(taskActivityHint({...task,snapshot:[{...c,kind:'exam'}]},{...state,attempts:[{id:'a',courseId:'c1',version:2,status:'pending_review',startedAt:'2026-10-16'}]}),'已交卷，等待管理员阅卷');
});
test('次数用尽查看最近答卷，最后一次仍在作答时允许续考，旧版本不占额度',()=>{
 const c={id:'c1',version:2,examAttempts:2};
 const old={id:'old',courseId:'c1',version:1,status:'graded',startedAt:'2026-10-18'};
 const first={...old,id:'first',version:2,startedAt:'2026-10-16'};
 const latest={...first,id:'latest',startedAt:'2026-10-17'};
 assert.equal(examEntry(c,{attempts:[old,first]}).action,'开始考试');
 const full=examEntry(c,{attempts:[first,old,latest]});
 assert.equal(full.used,2);assert.equal(full.exhausted,true);assert.equal(full.latest.id,'latest');assert.equal(full.action,'查看最近答卷');
 assert.equal(examEntry(c,{attempts:[first,{...latest,status:'active'}]}).action,'继续考试');
 assert.equal(examEntry(c,{attempts:[first,{...latest,status:'pending_review'}]}).exhausted,true);
});
const data = {
  completed: [],
  progress: [
    { courseId: 'c1', version: 1, lessonId: 'one' },
    { courseId: 'c1', version: 2, lessonId: 'two' },
    { courseId: 'c1', version: 2, lessonId: 'two' },
  ],
};
test('任务阶段区分待评价、待阅卷和可续答，且仅匹配冻结版本与最新记录',()=>{
 const c={id:'c1',version:2,kind:'train'};
 const state={...data,training:[{id:'old',courseId:'c1',version:1,status:'active',createdAt:'2026-10-17'},{id:'pending',courseId:'c1',version:2,status:'pending_review',createdAt:'2026-10-16'}],attempts:[]};
 assert.deepEqual(phaseActivity(c,state),{status:'待评价',action:'查看训练记录',href:'/recap/pending'});
 assert.equal(phaseActivity(c,{...state,completed:['c1:2']}).status,'已完成');
 const exam={...c,kind:'exam'};
 const attempt={id:'paper',courseId:'c1',version:2,status:'active',startedAt:'2026-10-16'};
 assert.equal(phaseActivity(exam,{...state,attempts:[attempt]}).action,'继续考试');
 assert.equal(phaseActivity(exam,{...state,attempts:[{...attempt,status:'pending_review'}]}).status,'待阅卷');
 assert.equal(phaseActivity(exam,{...state,attempts:[{...attempt,status:'graded'}]}).action,'查看结果');
 assert.equal(phaseActivity(exam,{...state,attempts:[{...attempt,version:1}]}).action,'开始考试');
 assert.equal(phaseActivity(c,{...state,training:[...state.training,{...state.training[1],id:'new',status:'active',createdAt:'2026-10-18'}]}).href,'/training/new');
});
test('学习进度只匹配固定版本且重复记录不增加完成度', () => {
  assert.equal(percent(course, data), 50);
  assert.equal(percent({ ...course, version: 1 }, data), 50);
  assert.equal(percent(course, { ...data, completed: ['c1:2'] }), 100);
});
test('先完成最后课时仍返回首个未完成课时，仅全部保存后才显示课程完成',()=>{
 assert.equal(firstIncompleteLesson(course,data),0);
 assert.equal(firstIncompleteLesson(course,{...data,progress:[...data.progress,{courseId:'c1',version:2,lessonId:'one'}]}),-1);
 assert.equal(firstIncompleteLesson(course,{...data,progress:[{courseId:'c1',version:1,lessonId:'one'},{courseId:'c1',version:1,lessonId:'two'}]}),0);
});
test('任务使用发布版本计算完成率与期限，完成任务不变为逾期', () => {
  const task = {
    start: '2026-10-15',
    due: '2026-10-30',
    completedMemberIds: [],
    snapshot: [
      { id: 'c1', version: 1 },
      { id: 'c2', version: 2 },
    ],
  };
  const snapshot = { ...data, completed: ['c1:2', 'c2:2'] };
  assert.equal(taskPercent(task, snapshot), 50);
  assert.equal(taskStatus(task, snapshot, '2026-10-14'), '未开始');
  assert.equal(taskStatus(task, snapshot, '2026-10-16'), '进行中');
  assert.equal(taskStatus(task, snapshot, '2026-11-01'), '已到期');
  assert.equal(taskStatus(task, { ...snapshot, completed: ['c1:1', 'c2:2'] }, '2026-11-01'), '已完成');
});
test('首门课程未学完时任务显示进行中，旧版本活动不影响新任务',()=>{
 const task={start:'2026-10-15',due:'2026-10-30',completedMemberIds:[],snapshot:[{id:'c1',version:2}]};
 const snapshot={completed:[],progress:[{courseId:'c1',version:2,lessonId:'two'}],attempts:[],training:[]};
 assert.equal(taskPercent(task,snapshot),0);assert.equal(taskStatus(task,snapshot,'2026-10-16'),'进行中');
 assert.equal(taskStatus(task,{...snapshot,progress:[{courseId:'c1',version:1,lessonId:'two'}]},'2026-10-16'),'待完成');
 assert.equal(taskStatus(task,{...snapshot,progress:[],attempts:[{courseId:'c1',version:2,status:'active'}]},'2026-10-16'),'进行中');
 assert.equal(taskStatus(task,snapshot,'2026-11-01'),'已到期');
});
test('考试剩余秒数不会为负，视频拒绝脚本和其他协议', () => {
  const expiry = '2026-10-15T10:30:00Z';
  assert.equal(secondsLeft(expiry, Date.parse(expiry) - 1500), 2);
  assert.equal(secondsLeft(expiry, Date.parse(expiry) + 100), 0);
  assert.equal(safeVideo('javascript:alert(1)'), null);
  assert.equal(safeVideo('data:text/html,a'), null);
  assert.equal(safeVideo('https://example.com/lesson.mp4'), 'https://example.com/lesson.mp4');
});


test('首页优先最近未完成学习，排除已完成课程和旧版本进度',()=>{
 const a={...course,id:'a'},b={...course,id:'b'},done={...course,id:'done'};
 const state={courses:[done,a,b],completed:['done:2'],progress:[{courseId:'a',version:2,lessonId:'one',completed_at:'2026-10-14T00:00:00Z'},{courseId:'b',version:2,lessonId:'one',completed_at:'2026-10-15T00:00:00Z'},{courseId:'a',version:1,lessonId:'two',completed_at:'2026-10-16T00:00:00Z'}]};
 assert.equal(nextLearningCourse(state).id,'b');
 assert.equal(nextLearningCourse({...state,completed:['done:2','b:2']}).id,'a');
 assert.equal(nextLearningCourse({...state,completed:['done:2','a:2','b:2']}),undefined);
 assert.equal(nextLearningCourse({...state,progress:[]}).id,'a');
});
test('跨端成长统计排除未开始和过期任务，不把进行中训练与待阅卷当正式结果',()=>{
 const make=(id,start,due,complete=false)=>({id,start,due,snapshot:[{id:'x',version:1}],completedMemberIds:complete?['me']:[]});
 const state={completed:['old:1','old:1','new:2'],tasks:[make('active','2026-10-01','2026-10-20',true),make('todo','2026-10-01','2026-10-20'),make('future','2026-11-01','2026-11-20'),make('expired','2026-09-01','2026-09-20',true)],training:[{status:'active'},{status:'pending_review'},{status:'completed'},{status:'failed'}],attempts:[{status:'graded',passed:true},{status:'graded',passed:false},{status:'pending_review',passed:null}],progress:[]};
 const result=learningSummary(state,'2026-10-15');
 assert.equal(result.completedVersions,2);assert.equal(result.effectiveTasks,2);assert.equal(result.effectiveDone,1);assert.equal(result.taskCompletion,50);assert.equal(result.trainingCount,3);assert.equal(result.passedExams,1);
 assert.equal(learningSummary({...state,tasks:[]},'2026-10-15').taskCompletion,0);
});
