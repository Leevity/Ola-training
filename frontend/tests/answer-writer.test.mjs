import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ExamAnswerWriter} from '../../packages/learner-client/src/answer-writer.ts';

test('共享答卷保存按序使用服务端修订，并冻结调用时的答案快照',async()=>{
 const calls=[];let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const writer=new ExamAnswerWriter(3,async(answers,revision)=>{calls.push({answers,revision});if(calls.length===1)await gate;return {revision:revision+1};});
 const input={q:['A']};const first=writer.save(input);input.q[0]='B';const second=writer.save({q:['C']});await Promise.resolve();release();await Promise.all([first,second]);
 assert.deepEqual(calls,[{answers:{q:['A']},revision:3},{answers:{q:['C']},revision:4}]);assert.equal(writer.revision,5);
});

test('跨端答卷冲突会停止已排队及后续保存，防止旧答案覆盖',async()=>{
 let calls=0;const conflict=Object.assign(new Error('remote changed'),{status:409});
 const writer=new ExamAnswerWriter(0,async()=>{calls++;throw conflict;});
 const first=writer.save({q:['A']}),second=writer.save({q:['B']});
 const result=await Promise.allSettled([first,second]);assert(result.every(r=>r.status==='rejected'));assert.equal(writer.locked,true);assert.equal(calls,1);await assert.rejects(writer.save({q:['C']}));assert.equal(calls,1);
});

test('普通网络错误保留原修订可重试，不误当成远端冲突',async()=>{
 let calls=0;const revisions=[];const writer=new ExamAnswerWriter(7,async(_,revision)=>{revisions.push(revision);calls++;if(calls===1)throw new Error('offline');return {revision:8};});
 await assert.rejects(writer.save({q:['A']}));assert.equal(writer.locked,false);await writer.save({q:['A']});assert.deepEqual(revisions,[7,7]);assert.equal(writer.revision,8);
});
