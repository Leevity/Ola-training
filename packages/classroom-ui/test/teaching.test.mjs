import {test} from 'node:test';
import assert from 'node:assert/strict';
import {teachingStep,replaceSpeechActions} from '../src/teaching.ts';

test('讲解按非空语音段导航，旧聚焦动作位置可恢复到对应段落',()=>{
 const actions=[{id:'f0',type:'spotlight',elementId:'intro'},{id:'s1',type:'speech',text:'第一段'},{id:'l1',type:'laser',elementId:'first'},{id:'s2',type:'speech',text:'第二段'},{id:'f2',type:'spotlight',elementId:'second'},{id:'empty',type:'speech',text:'  '}];
 const first=teachingStep(actions,0);assert.equal(first.number,1);assert.equal(first.total,2);assert.equal(first.previous,undefined);assert.equal(first.next,3);assert.equal(first.focus.elementId,'first');
 assert.equal(teachingStep(actions,2).speech.text,'第一段');
 const second=teachingStep(actions,first.next);assert.equal(second.number,2);assert.equal(second.previous,1);assert.equal(second.next,undefined);assert.equal(second.focus.elementId,'second');
 assert.equal(teachingStep([],0),null);assert.equal(teachingStep([{id:'f',type:'spotlight',elementId:'x'}],0),null);
});

test('删减讲解段落不保留空语音，新增段落保留已有讲解与聚焦标识',()=>{
 const actions=[{id:'s1',type:'speech',text:'旧一'},{id:'f',type:'spotlight',elementId:'x'},{id:'s2',type:'speech',text:'旧二'}];
 const fewer=replaceSpeechActions(actions,'新一\n\n  ',()=>assert.fail('无需新增ID'));assert.deepEqual(fewer,[{id:'s1',type:'speech',text:'新一'},actions[1]]);
 const more=replaceSpeechActions(actions,'一\n\n二\n\n三',()=> 's3');assert.deepEqual(more.map(a=>a.id),['s1','f','s2','s3']);assert.equal(more.at(-1).text,'三');assert.equal(actions[0].text,'旧一');
});
