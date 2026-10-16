// Explicit hand-authored local fixture for PC -> H5 -> management reporting. Does not invoke or simulate AI generation.
import {readFile} from 'node:fs/promises';
if(process.env.NODE_ENV==='production'||process.env.DATABASE_URL)throw new Error('Local fixture only');
const base='http://127.0.0.1:4180/api',courseId='ola-cross-device-ui-demo',taskId='ola-cross-device-ui-task';
const health=await fetch(base+'/health');if(!health.ok||(await health.json()).database!=='pglite')throw new Error('Requires local PGlite');
const credentials=await readFile(new URL('../data/bootstrap-credentials.txt',import.meta.url),'utf8');
const login=await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:credentials.match(/邮箱：(.+)/)?.[1].trim(),password:credentials.match(/密码：(.+)/)?.[1].trim()})});
if(!login.ok)throw new Error('Admin login failed');const cookie=login.headers.get('set-cookie').split(';')[0],csrf=(await login.json()).csrf;
async function call(path,method='GET',body){const r=await fetch(base+path,{method,headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw new Error(`API ${path}: ${r.status}`);return r.json();}
try{
 await call('/auth/switch-tenant','POST',{tenantId:'fujian'});const snapshot=await call('/bootstrap'),member=snapshot.db.members.find(m=>m.employeeNo==='EMP1001'&&m.email);if(!member)throw new Error('Missing local learner fixture');
 if(!snapshot.db.courses.some(c=>c.id===courseId)){
  const source=snapshot.db.courses.find(c=>c.id==='ola-classroom-ui-demo'&&c.title.includes('手工测试课件'));if(!source?.classroom)throw new Error('Run setup-classroom-demo first');
  const form=new FormData();form.append('file',new Blob(['# 跨端学习验收资料\n\n先确认使用场景、预算和家庭人数，再复述需求并推荐方案。'],{type:'text/markdown'}),'cross-device-qa.md');
  const upload=await fetch(base+'/tenants/fujian/knowledge',{method:'POST',headers:{cookie,'x-csrf-token':csrf},body:form});if(!upload.ok)throw new Error('Fixture file upload failed');const knowledge=(await upload.json());
  const document=structuredClone(source.classroom);document.stage.id='cross-device-stage';document.stage.name='跨端学习验收（手工测试课件）';document.scenes.forEach(s=>s.stageId=document.stage.id);
  await call('/tenants/fujian/courses','POST',{...source,id:courseId,title:document.stage.name,summary:'手工测试内容：先在PC学习，再到H5完成，验证同一版本的记录与管理报告。',knowledgeIds:[knowledge.id],classroom:document,audience:{mode:'members',departments:[],memberIds:[member.id]},publish:true});
 }
 if(!snapshot.db.tasks.some(t=>t.id===taskId))await call('/tenants/fujian/tasks','POST',{id:taskId,title:'PC 到 H5 跨端验收任务',description:'PC 完成第一课时，手机完成后续内容；所有记录由业务服务保存。',start:new Date().toISOString().slice(0,10),due:new Date(Date.now()+30*86400000).toISOString().slice(0,10),sequential:true,courseIds:[courseId],memberIds:[member.id],publish:true});
 console.log(JSON.stringify({courseId,taskId,source:'hand-authored local QA fixture'}));
}finally{await call('/auth/logout','POST',{});}
