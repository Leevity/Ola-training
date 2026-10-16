import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withReturnTo,returnDestination,routeChoice,choiceRoute} from '../../shared/learner-navigation.ts';
import {learningHistory} from '../../shared/learner-history.ts';
test('记录和消息来源携带筛选条件，拒绝外部或未识别的返回目标',()=>{
 const destination=withReturnTo('/exam/answer','#/messages?tab=unread');
 assert.equal(returnDestination('#'+destination,'/history'),'/messages?tab=unread');
 for(const value of ['https://evil.example','//evil.example','/\\evil.example','/messages#other','/unknown','/messages\n'])assert.equal(returnDestination('#/exam/a?returnTo='+encodeURIComponent(value),'/history'),'/history');
 assert.equal(withReturnTo('/course/a?v=2','#/history?tab=learn').startsWith('/course/a?v=2&returnTo='),true);
});
test('列表状态只接受已知选项，修改筛选保留其他参数',()=>{
 assert.equal(routeChoice('#/history?tab=exam','tab',['learn','exam'],'learn'),'exam');
 assert.equal(routeChoice('#/history?tab=invalid','tab',['learn','exam'],'learn'),'learn');
 assert.equal(choiceRoute('#/my/history?type=exam&status=all',{status:'done'}),'/my/history?type=exam&status=done');
});
test('任务到固定版本课程再到课堂逐级返回，保留任务来源并拒绝非法详情路径',()=>{
 const task='/task/task-1?returnTo=%2Fmessages%3Ftab%3Dunread';
 const course=withReturnTo('/course/course-1?v=2','#'+task);
 const classroom=withReturnTo('/content/course-1?v=2&lesson=3','#'+course);
 assert.equal(returnDestination('#'+classroom,'/courses'),course);
 assert.equal(returnDestination('#'+course,'/courses'),task);
 assert.equal(returnDestination('#'+task,'/tasks'),'/messages?tab=unread');
 for(const value of ['/course/../admin','/task/a/b','/course/','/course/'+ 'x'.repeat(81)])assert.equal(returnDestination('#/content/c?returnTo='+encodeURIComponent(value),'/courses'),'/courses');
});
test('学习记录按固定版本聚合和去重，历史标题不用新版本替换，按最近活动排序',()=>{
 const data={courses:[{id:'c',version:2,title:'新版课程',lessons:[{id:'l1'},{id:'l2'}]}],tasks:[{snapshot:[{id:'c',version:1,title:'历史课程名'}]}],progress:[{courseId:'c',version:1,lessonId:'old',completed_at:'2026-10-15'},{courseId:'c',version:2,lessonId:'l1',completed_at:'2026-10-16'},{courseId:'c',version:2,lessonId:'l1',completed_at:'2026-10-17'}]};
 const rows=learningHistory(data);
 assert.equal(rows.length,2);assert.equal(rows[0].id,'c:2');assert.equal(rows[0].status,'1/2 课时已完成');assert.equal(rows[0].at,'2026-10-17');assert.equal(rows[1].title,'历史课程名');assert.equal(rows[1].status,'已完成 1 个课时');assert.equal(rows[1].href,'/content/c?v=1');
});
