import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
const dom=new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window=dom.window;globalThis.document=dom.window.document;
const {safeHtml,safeMedia,cleanScene,sandboxHtml}=await import('../src/safety.ts');
test('课件HTML移除脚本、事件、危险链接与越界样式，保留排版',()=>{
 const value=safeHtml('<script>window.stolen=true</script><h1 style="font-size:38px;color:#172238;position:fixed;background-image:url(https://evil.example/x)">标题</h1><img src="javascript:alert(1)" onerror="alert(1)"><a href="javascript:alert(1)">链接</a><iframe src="https://evil.example"></iframe>');
 assert(!/script|onerror|javascript|position:|background-image|iframe|href=/.test(value));assert(value.includes('font-size: 38px'));assert(value.includes('标题'));
});
test('媒体只接受允许协议，未知课件拒绝渲染且不修改原文档',()=>{
 assert.equal(safeMedia('javascript:alert(1)'),undefined);assert.equal(safeMedia('//evil.example/x'),undefined);assert.equal(safeMedia('data:text/html;base64,PHNjcmlwdD4='),undefined);assert.equal(safeMedia('/api/assets/test'),'/api/assets/test');
 assert.equal(cleanScene({type:'slide'}),null);
 const scene={id:'s1',stageId:'stage',type:'slide',title:'测试',order:1,content:{type:'slide',canvas:{elements:[{type:'text',content:'<p onclick="alert(1)">安全正文</p>'}]}},actions:[]};
 const cleaned=cleanScene(scene);assert(!cleaned.content.canvas.elements[0].content.includes('onclick'));assert(scene.content.canvas.elements[0].content.includes('onclick'));
});
test('互动文档先设置CSP，禁止联网、表单和嵌套资源',()=>{
 const value=sandboxHtml('<button>互动</button><script>document.body.dataset.ready="1"</script>');assert(value.indexOf('Content-Security-Policy')<value.indexOf('<script>'));assert(value.includes("connect-src 'none'"));assert(value.includes("form-action 'none'"));assert(value.includes("default-src 'none'"));
});
