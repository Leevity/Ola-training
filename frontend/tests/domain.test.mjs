import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percent, taskPercent, taskStatus, secondsLeft, safeVideo } from '../src/domain.ts';
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
