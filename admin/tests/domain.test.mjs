import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveCourse,csvCell,publishTask,validateCourse,validateTask} from '../src/domain.ts';
const course={id:'c1',tenantId:'a',title:'服务课程',summary:'介绍',kind:'learn',status:'published',version:2,duration:20,lessons:[{title:'基础',content:'服务正文',format:'文档'}],knowledgeIds:[]};
const member={id:'m1',tenantId:'a',active:true};
const task={id:'t1',tenantId:'a',title:'培训任务',start:'2026-10-15',due:'2026-10-31',status:'draft',courseIds:['c1'],memberIds:['m1'],snapshot:[]};
test('任务发布拒绝跨企业课程、跨企业成员以及停用成员',()=>{
  assert.match(validateTask(task,[{...course,tenantId:'b'}],[member],true),/本企业已发布/);
  assert.match(validateTask(task,[course],[{...member,tenantId:'b'}],true),/本企业已启用/);
  assert.match(validateTask(task,[course],[{...member,active:false}],true),/本企业已启用/);
});
test('任务只引用已发布课程，不能有空名单、重复引用或倒置日期',()=>{
  assert.match(validateTask(task,[{...course,status:'draft'}],[member],true),/已发布/);
  assert.match(validateTask({...task,memberIds:[]},[course],[member],true),/接收成员/);
  assert.match(validateTask({...task,courseIds:['c1','c1']},[course],[member],true),/重复/);
  assert.match(validateTask({...task,due:'2026-10-01'},[course],[member],true),/截止日期/);
  assert.match(validateTask({...task,start:'2026-02-30'},[course],[member],true),/有效日期/);
});
test('发布保存课程版本摘要和名单，后续编辑不改变已发布摘要',()=>{
  const courses=[{...course}],members=[{...member}];const value=publishTask(task,courses,members);
  courses[0].title='新版名称';courses[0].version=3;task.memberIds.push('m2');
  assert.equal(value.snapshot[0].title,'服务课程');assert.equal(value.snapshot[0].version,2);assert.deepEqual(value.memberIds,['m1']);task.memberIds.pop();
  assert.throws(()=>publishTask(value,[course],[member]),/只有草稿/);
});
test('被已发布任务引用的课程不能归档，其他企业任务不影响当前课程',()=>{
  const db={courses:[course],tasks:[{...task,status:'published'}]};
  assert.throws(()=>archiveCourse('c1',db,'a'),/已发布任务引用/);
  const next=archiveCourse('c1',{...db,tasks:[{...task,status:'published',tenantId:'b'}]},'a');
  assert.equal(next.courses[0].status,'archived');assert.equal(course.status,'published');
  assert.throws(()=>archiveCourse('c1',db,'b'),/不存在/);
});
test('发布课程拒绝空课时、无效参数和跨企业知识关联',()=>{
  assert.match(validateCourse({...course,lessons:[]},[],true),/课时/);
  assert.match(validateCourse({...course,duration:NaN},[],true),/时长/);
  assert.match(validateCourse({...course,knowledgeIds:['k1']},[{id:'k1',tenantId:'b',status:'ready'}],true),/关联知识/);
  assert.match(validateCourse({...course,kind:'exam',examPass:NaN,examMinutes:30,examAttempts:3},[],true),/有效/);
  assert.match(validateCourse({...course,lessons:[{title:'视频',content:'javascript:alert(1)',format:'视频链接'}]},[],true),/HTTP/);
  assert.equal(validateCourse(course,[],true),'');
});
test('CSV 导出转义引号、换行及公式前缀',()=>{
  assert.equal(csvCell('a"b\nc'),'"a""b\nc"');
  assert.equal(csvCell('=SUM(A1)'),'"\'=SUM(A1)"');
  assert.equal(csvCell(' +cmd'),'"\' +cmd"');
});
