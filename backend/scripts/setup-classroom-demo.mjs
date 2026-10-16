// Local browser QA only. This is explicitly hand-authored test content, never an AI generation result.
import { readFile } from 'node:fs/promises';
import { DSL_VERSION, normalizeElement } from '@openmaic/dsl';
if(process.env.NODE_ENV==='production'||process.env.DATABASE_URL)throw new Error('Local demo only');
const base='http://127.0.0.1:4180/api',cid='ola-classroom-ui-demo',title='课堂编辑与学习验收（手工测试课件）';
const health=await fetch(base+'/health');if(!health.ok||(await health.json()).database!=='pglite')throw new Error('Requires local PGlite service');
const credentials=await readFile(new URL('../data/bootstrap-credentials.txt',import.meta.url),'utf8');
const login=await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:credentials.match(/邮箱：(.+)/)?.[1].trim(),password:credentials.match(/密码：(.+)/)?.[1].trim()})});
if(!login.ok)throw new Error('Local admin login failed');const cookie=login.headers.get('set-cookie').split(';')[0],csrf=(await login.json()).csrf;
async function call(path,method='GET',body){const r=await fetch(base+path,{method,headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw new Error(`API ${path}: ${r.status} ${await r.text()}`);return r.json();}
try{
 await call('/auth/switch-tenant','POST',{tenantId:'fujian'});const snapshot=await call('/bootstrap');const existing=snapshot.db.courses.find(c=>c.id===cid);
 if(existing){if(existing.title!==title)throw new Error('Fixture ID belongs to another record');console.log(JSON.stringify({courseId:cid,existing:true}));}
 else{
  const stageId='classroom-demo-stage',now=Date.now(),theme={backgroundColor:'#ffffff',themeColors:['#246bfe'],fontColor:'#172238',fontName:'Microsoft YaHei',outline:{color:'#246bfe',width:1,style:'solid'},shadow:{h:0,v:0,blur:0,color:'#000000'}};
  const scenes=[{id:'demo-slide',stageId,type:'slide',title:'先确认需求，再推荐方案',order:1,content:{type:'slide',canvas:{id:'demo-canvas',viewportSize:1000,viewportRatio:.5625,theme,background:{type:'solid',color:'#ffffff'},elements:[normalizeElement({id:'demo-title',type:'text',left:70,top:60,width:860,height:100,content:'<h1 style="font-size:38px;color:#172238">先确认需求，再推荐方案</h1>'}),normalizeElement({id:'demo-body',type:'text',left:70,top:200,width:860,height:220,content:'<p style="font-size:26px;line-height:1.8;color:#5f6f86">了解使用场景、预算和家庭人数。<br>复述客户需求，确认理解一致。<br>说明方案与需求的对应关系。</p>'})]}},actions:[{id:'demo-speech-1',type:'speech',text:'先询问客户的使用场景和预算，再确认家庭人数。'},{id:'demo-spotlight',type:'spotlight',elementId:'demo-body'},{id:'demo-speech-2',type:'speech',text:'复述需求并获得确认后，再说明推荐方案的理由。'}]},
  {id:'demo-quiz',stageId,type:'quiz',title:'需求识别课内练习',order:2,content:{type:'quiz',questions:[{id:'demo-q1',type:'single',question:'推荐方案前，应先做什么？',options:[{value:'A',label:'了解使用场景和预算'},{value:'B',label:'介绍所有产品'}],answer:['A'],analysis:'了解真实需求后，才能说明方案的匹配理由。'}]},actions:[{id:'demo-quiz-speech',type:'speech',text:'请选择更合适的沟通顺序，提交后查看解析。'}]},
  {id:'demo-widget',stageId,type:'interactive',title:'互动练习：选择开场问题',order:3,content:{type:'interactive',url:'',html:'<main style="font:16px/1.8 sans-serif;padding:24px;color:#172238"><h2>客户走进营业厅，先问哪一句？</h2><button onclick="document.getElementById(\'result\').textContent=\'很好，先了解客户需求。\'">您主要在什么场景使用？</button><p id="result" aria-live="polite">选择后查看提示。</p></main>',widgetType:'simulation'},actions:[]}];
  const seed=snapshot.db.courses.find(c=>c.id==='fujian-c0');if(!seed)throw new Error('Missing development seed');
  const course={...seed,id:cid,title,summary:'手工编写的本地验收课件，用于验证编辑、预览、课内答题与学习记录。',knowledgeIds:[],lessons:scenes.map(s=>({id:s.id,title:s.title,format:'AI课堂',content:s.id})),classroom:{dslVersion:DSL_VERSION,stage:{id:stageId,name:title,createdAt:now,updatedAt:now},scenes},publish:true};
  await call('/tenants/fujian/courses','POST',course);
  const member=snapshot.db.members.find(m=>m.employeeNo==='EMP1001'&&m.email);if(!member)throw new Error('Run setup-learner-demo first');
  await call('/tenants/fujian/tasks','POST',{id:'ola-classroom-ui-task',title:'课堂学习验收任务',description:'使用手工测试课件验证课堂学习和进度保存。',start:new Date().toISOString().slice(0,10),due:new Date(Date.now()+30*86400000).toISOString().slice(0,10),sequential:true,courseIds:[cid],memberIds:[member.id],publish:true});
  console.log(JSON.stringify({courseId:cid,taskId:'ola-classroom-ui-task',source:'hand-authored QA fixture'}));
 }
}finally{await call('/auth/logout','POST',{});}
