import {test} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {extractMaterial} from '../src/material-parser.ts';

function presentation(order=[2,1]){
 const zip=new JSZip();
 zip.file('ppt/presentation.xml',`<p:presentation xmlns:p="urn:p" xmlns:rel="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst>${order.map((id,i)=>`<p:sldId id="${256+i}" rel:id="r${id}"/>`).join('')}</p:sldIdLst></p:presentation>`);
 zip.file('ppt/_rels/presentation.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+[1,2].map(id=>`<Relationship Id="r${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${id}.xml"/>`).join('')+'</Relationships>');
 for(const id of [1,2,99])zip.file(`ppt/slides/slide${id}.xml`,`<p:sld xmlns:p="urn:p" xmlns:a="urn:a"><a:p><a:r><a:t>虚构第${id}张</a:t></a:r></a:p></p:sld>`);
 return zip;
}
const parse=async(zip:JSZip)=>extractMaterial('reordered.pptx',await zip.generateAsync({type:'nodebuffer'}));
test('PPT采用演示页序和命名空间关联，忽略不在演示列表的遗留页面',async()=>{
 assert.deepEqual(await parse(presentation()),[{page:1,text:'虚构第2张'},{page:2,text:'虚构第1张'}]);
});
test('PPT拒绝缺失、重复和外部引用，不用文件名猜页序',async()=>{
 await assert.rejects(()=>parse(presentation([2,2])),/重复/);
 await assert.rejects(()=>parse(presentation([3])),/引用缺失/);
 const missing=presentation();missing.remove('ppt/slides/slide2.xml');await assert.rejects(()=>parse(missing),/引用无效/);
 const noOrder=presentation();noOrder.remove('ppt/presentation.xml');await assert.rejects(()=>parse(noOrder),/缺少正文/);
 for(const target of ['https://example.invalid/a.xml','../../outside.xml','slides/slide1.xml" TargetMode="External']){
  const zip=presentation();zip.file('ppt/_rels/presentation.xml.rels',`<Relationships><Relationship Id="r2" Type="urn:test/slide" Target="${target}"/></Relationships>`);
  await assert.rejects(()=>parse(zip),/引用无效/);
 }
});
test('PPT限制演示页数并拒绝元数据实体',async()=>{
 await assert.rejects(()=>parse(presentation(Array.from({length:501},(_,i)=>i%2+1))),/超过500/);
 const zip=presentation();zip.file('ppt/presentation.xml','<!DOCTYPE p [<!ENTITY leak SYSTEM "file:///secret">]><p>&leak;</p>');await assert.rejects(()=>parse(zip),/外部实体/);
});
test('长资料字符上限、UTF8和Office解压上限可预期拒绝',async()=>{
 assert.equal((await extractMaterial('long.md',Buffer.from('学'.repeat(500000))))[0].text.length,500000);
 await assert.rejects(()=>extractMaterial('over.md',Buffer.from('学'.repeat(500001))),/50万字符/);
 await assert.rejects(()=>extractMaterial('bad.txt',Buffer.from([0xff,0xfe,0x80])));
 const zip=new JSZip();zip.file('word/document.xml','<document><p><t>'+ 'x'.repeat(20*1024*1024)+'</t></p></document>');
 const buffer=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
 await assert.rejects(()=>extractMaterial('expanded.docx',buffer),/解压内容超过限制/);
});
