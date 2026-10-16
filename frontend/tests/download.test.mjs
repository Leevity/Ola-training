import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filenameFromDisposition,knowledgeDownloadPath} from '../../packages/learner-client/src/download.ts';
test('下载文件名保留中文，清除目录和控制字符，损坏编码安全回退',()=>{
 assert.equal(filenameFromDisposition("attachment; filename*=UTF-8''"+encodeURIComponent('培训资料.docx')),'培训资料.docx');
 assert.equal(filenameFromDisposition('attachment; filename="../../report.docx"'),'report.docx');
 assert.equal(filenameFromDisposition("attachment; filename*=UTF-8''%zz"),'学习资料');
 assert.equal(filenameFromDisposition('attachment; filename=".."'),'学习资料');
 assert.equal(filenameFromDisposition('attachment; filename="a'+String.fromCharCode(10)+'b.txt"'),'a_b.txt');
 assert.equal(knowledgeDownloadPath('file-a',{courseId:'course-b',version:2}),'/learn/knowledge/file-a/download?courseId=course-b&version=2');
});
