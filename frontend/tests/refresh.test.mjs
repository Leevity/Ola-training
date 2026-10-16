import {test} from 'node:test';
import assert from 'node:assert/strict';
import {watchLearningRefresh} from '../../shared/learner-refresh.ts';
const turn=()=>new Promise(resolve=>setImmediate(resolve));
test('跨端刷新合并并发事件并在返回页面后补读最新数据，卸载停止同步',async()=>{
 const priorWindow=globalThis.window,priorDocument=globalThis.document;
 const win=new EventTarget(),doc=new EventTarget();doc.visibilityState='visible';
 let timer,cleared=false,calls=0,release;
 win.setInterval=callback=>{timer=callback;return 1;};win.clearInterval=()=>{cleared=true;};
 globalThis.window=win;globalThis.document=doc;
 try{
  const errors=[];const stop=watchLearningRefresh(async()=>{calls++;if(calls===1)await new Promise(resolve=>{release=resolve;});},error=>errors.push(error));
  win.dispatchEvent(new Event('focus'));win.dispatchEvent(new Event('hashchange'));doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(calls,1);release();await turn();assert.equal(calls,2);
  doc.visibilityState='hidden';timer();await turn();assert.equal(calls,2);
  doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));await turn();assert.equal(calls,3);
  stop();win.dispatchEvent(new Event('focus'));timer();await turn();assert.equal(calls,3);assert(cleared);assert.deepEqual(errors,[]);
 }finally{globalThis.window=priorWindow;globalThis.document=priorDocument;}
});
