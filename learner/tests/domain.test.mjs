import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percent, taskPercent, taskStatus, secondsLeft, safeVideo, nextLearningCourse, learningSummary } from '../src/domain.ts';
const course = { id: 'c1', version: 2, kind: 'learn', lessons: [{ id: 'one' }, { id: 'two' }] };
const data = {
  completed: [],
  progress: [
    { courseId: 'c1', version: 1, lessonId: 'one' },
    { courseId: 'c1', version: 2, lessonId: 'two' },
    { courseId: 'c1', version: 2, lessonId: 'two' },
  ],
};
test('学习进度只匹配固定版本且重复记录不增加完成度', () => {
  assert.equal(percent(course, data), 50);
  assert.equal(percent({ ...course, version: 1 }, data), 50);
  assert.equal(percent(course, { ...data, completed: ['c1:2'] }), 100);
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
