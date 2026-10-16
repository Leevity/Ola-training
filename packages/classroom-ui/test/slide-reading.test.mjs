import assert from 'node:assert/strict';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window=dom.window;globalThis.document=dom.window.document;
const {slideReadingText}=await import('../src/slide-reading.ts');
test('文字阅读按画面位置排列，保留段落、实体和形状文字，不执行生成HTML',()=>{
 const elements=[
  {type:'shape',top:100,left:20,text:{content:'<p>预算 &amp; 期限</p><p>每月120元<br>下周一之前</p>'}},
  {type:'text',top:0,left:40,content:'<p style="font-size:8px">标题</p><script>bad()</script>'},
  {type:'image',top:0,left:0,src:'https://example.invalid/image.png'},
  {type:'text',top:100,left:0,content:'<img onerror="bad()">左侧要点'}
 ];
 const before=JSON.stringify(elements);
 assert.deepEqual(slideReadingText(elements),['标题','左侧要点','预算 & 期限\n每月120元\n下周一之前']);
 assert.equal(JSON.stringify(elements),before);
 assert.deepEqual(slideReadingText([]),[]);
});
