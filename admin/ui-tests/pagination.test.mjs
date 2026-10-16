import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
const {JSDOM}=createRequire(new URL('../../packages/classroom-ui/package.json',import.meta.url))('jsdom');

test('普通大列表分页保持有限按钮，首尾可达且当前页与边界正确',async()=>{
 const dom=new JSDOM('<div id="root"></div>');
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.HTMLElement=dom.window.HTMLElement;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {createRoot}=await import('react-dom/client');const {Pagination}=await import('../src/ui.tsx');
 const root=createRoot(document.getElementById('root'));let chosen;
 const render=async(total,page)=>act(async()=>root.render(React.createElement(Pagination,{total,page,onPage:value=>{chosen=value;}})));
 const button=name=>document.querySelector(`button[aria-label="${name}"]`);
 try{
  await render(130,1);assert.ok(document.querySelectorAll('button').length<=9);assert.equal(button('上一页').disabled,true);
  await act(async()=>button('第 22 页').click());assert.equal(chosen,22);
  await render(130,22);assert.equal(button('下一页').disabled,true);assert.equal(button('第 22 页').getAttribute('aria-current'),'page');
  await render(130,11);assert.ok(button('第 10 页'));assert.ok(button('第 12 页'));assert.ok(button('第 1 页'));assert.ok(button('第 22 页'));
  await act(async()=>button('下一页').click());assert.equal(chosen,12);
  await render(1,1);assert.equal(document.querySelectorAll('button').length,3);assert.equal(button('上一页').disabled,true);assert.equal(button('下一页').disabled,true);
  await render(60000,5000);assert.ok(document.querySelectorAll('button').length<=9);assert.ok(button('第 10000 页'));
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
