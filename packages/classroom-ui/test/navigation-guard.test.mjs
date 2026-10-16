import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {protectUnsaved,registerLeaveGuard,allowLeaving,navigateHash,prepareHistoryBack,watchHashRoute} from '../../../shared/navigation-guard.ts';
test('站内导航、直接hash与历史返回共用离开检查，拒绝后保留页面及历史状态',async()=>{
 const dom=new JSDOM('',{url:'http://localhost/#/content/course'});globalThis.window=dom.window;globalThis.location=dom.window.location;globalThis.history=dom.window.history;
 history.replaceState({olaDepth:3},'');let allowed=false,checks=0;const routes=[],removeGuard=registerLeaveGuard(()=>{checks++;return allowed;});const cleanup=watchHashRoute(route=>routes.push(route));
 try{assert.equal(navigateHash('/tasks'),false);assert.equal(location.hash,'#/content/course');assert.equal(prepareHistoryBack(),false);assert.equal(allowLeaving(),false);
 location.hash='/tasks';window.dispatchEvent(new dom.window.Event('hashchange'));assert.equal(location.hash,'#/content/course');assert.deepEqual(history.state,{olaDepth:3});assert.deepEqual(routes,[]);
 await new Promise(resolve=>setTimeout(resolve,0));allowed=true;const before=checks;assert.equal(navigateHash('/tasks'),true);window.dispatchEvent(new dom.window.Event('hashchange'));assert.equal(checks,before+1);assert.deepEqual(routes,['/tasks']);await new Promise(resolve=>setTimeout(resolve,0));
 allowed=false;history.replaceState(null,'','#/home');window.dispatchEvent(new dom.window.Event('hashchange'));assert.equal(location.hash,'#/tasks');assert.deepEqual(routes,['/tasks']);
 removeGuard();assert.equal(allowLeaving(),true);assert.equal(prepareHistoryBack(false),true);
 }finally{removeGuard();cleanup();dom.window.close();}
});
test('宿主写入的历史深度在取消导航后保留，卸载后不会留下旧守卫',async()=>{
 const dom=new JSDOM('',{url:'http://localhost/#/content/course'});globalThis.window=dom.window;globalThis.location=dom.window.location;globalThis.history=dom.window.history;
 const removeGuard=registerLeaveGuard(()=>false),cleanup=watchHashRoute(()=>assert.fail('must stay'));history.replaceState({olaDepth:2},'');await Promise.resolve();location.hash='/tasks';window.dispatchEvent(new dom.window.Event('hashchange'));assert.deepEqual(history.state,{olaDepth:2});assert.equal(location.hash,'#/content/course');removeGuard();cleanup();assert.equal(navigateHash('/tasks'),true);dom.window.close();
});

test('未保存表达守卫读取最新状态，取消不离开，刷新提示及清理正确',()=>{
 const dom=new JSDOM('',{url:'http://localhost/#/training/id'});globalThis.window=dom.window;let dirty=true,flushed=0;window.confirm=()=>false;const remove=protectUnsaved(()=>dirty,'未保存',()=>flushed++);
 try{assert.equal(allowLeaving(),false);assert.equal(flushed,1);const before=new dom.window.Event('beforeunload',{cancelable:true});window.dispatchEvent(before);assert.equal(before.defaultPrevented,true);dirty=false;assert.equal(allowLeaving(),true);assert.equal(flushed,2);remove();dirty=true;assert.equal(allowLeaving(),true);const after=new dom.window.Event('beforeunload',{cancelable:true});window.dispatchEvent(after);assert.equal(after.defaultPrevented,false);}finally{remove();dom.window.close();}
});
