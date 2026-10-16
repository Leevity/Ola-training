import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { Database } from './db.ts';
import type { Config } from './config.ts';
import { seedDatabase } from '../../shared/seed.ts';
import { hashPassword } from './auth.ts';
export async function initialize(db:Database,config:Config){
  const migrations=await Promise.all(['001_initial.sql','002_learner_portal.sql','003_ai_provider.sql','004_authoring.sql','005_classroom_runtime.sql','006_content_audience.sql','007_exam_answers_revision.sql','008_course_assets.sql'].map(name=>readFile(new URL('../migrations/'+name,import.meta.url),'utf8')));
  await db.transaction(async tx=>{
    if(db.kind==='postgres')await tx.query('SELECT pg_advisory_xact_lock(72419001)');
    await tx.query('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const versions=(await tx.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map(r=>r.version);
    if(versions.some(v=>v>migrations.length))throw new Error('Database schema is newer than this backend');
    for(const [index,sql] of migrations.entries())if(!versions.includes(index+1))for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await tx.query(statement);
  });
  if((await db.query('SELECT id FROM accounts LIMIT 1')).rows.length)return;
  if(config.production&&!config.adminPassword)throw new Error('First production boot requires BOOTSTRAP_ADMIN_PASSWORD');
  const password=config.adminPassword||randomBytes(20).toString('base64url');const hash=await hashPassword(password);
  const seed=seedDatabase();
  if(!config.seedDemo){seed.tenants=[{id:'default',name:'默认企业',shortName:'默认企业',description:'',departments:['管理部']}];seed.members=[];seed.courses=[];seed.tasks=[];seed.knowledge=[];}
  const accountId=randomUUID();
  const created=await db.transaction(async tx=>{
    if(db.kind==='postgres')await tx.query('SELECT pg_advisory_xact_lock(72419002)');
    if((await tx.query('SELECT id FROM accounts LIMIT 1')).rows.length)return false;
    await tx.query('INSERT INTO accounts(id,email,password_hash,platform_admin) VALUES($1,$2,$3,TRUE)',[accountId,config.adminEmail.toLowerCase(),hash]);
    for(const t of seed.tenants)await tx.query('INSERT INTO tenants(id,name,short_name,description,departments) VALUES($1,$2,$3,$4,$5)',[t.id,t.name,t.shortName,t.description,JSON.stringify(t.departments)]);
    for(const m of seed.members)await tx.query('INSERT INTO members(id,tenant_id,name,employee_no,department,role,active) VALUES($1,$2,$3,$4,$5,$6,$7)',[m.id,m.tenantId,m.name,m.employeeNo,m.department,m.role,m.active]);
    for(const t of seed.tenants)await tx.query('INSERT INTO members(id,tenant_id,account_id,name,employee_no,department,role) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),t.id,accountId,'平台管理员','ADMIN',t.departments[0],'企业管理员']);
    for(const c of seed.courses){await tx.query('INSERT INTO courses(id,tenant_id,title,kind,category,status,version,data,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[c.id,c.tenantId,c.title,c.kind,c.category,c.status,c.version,JSON.stringify(c),c.updatedAt]);if(c.status==='published')await tx.query('INSERT INTO course_versions(tenant_id,course_id,version,content) VALUES($1,$2,$3,$4)',[c.tenantId,c.id,c.version,JSON.stringify(c)]);}
    for(const k of seed.knowledge)await tx.query('INSERT INTO knowledge(id,tenant_id,name,category,size,mime,status,text_content) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[k.id,k.tenantId,k.name,k.category,k.size,k.mime,k.status,k.text]);
    for(const t of seed.tasks){await tx.query('INSERT INTO tasks(id,tenant_id,title,description,start_date,due_date,status,sequential,assigned_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[t.id,t.tenantId,t.title,t.description,t.start,t.due,t.status,t.sequential,t.assignedAt||null]);for(const [i,courseId] of t.courseIds.entries())await tx.query('INSERT INTO task_items(tenant_id,task_id,course_id,course_version,position) VALUES($1,$2,$3,$4,$5)',[t.tenantId,t.id,courseId,t.status==='published'?1:null,i]);for(const memberId of t.memberIds)await tx.query('INSERT INTO assignments(tenant_id,task_id,member_id) VALUES($1,$2,$3)',[t.tenantId,t.id,memberId]);}
    for(const c of seed.courses.filter(c=>c.kind==='exam')){
      const questions=[{id:'q1',type:'single',title:'推荐方案前应先做什么？',options:[{id:'A',text:'询问使用场景'},{id:'B',text:'直接介绍全部产品'}],answers:['A'],points:40,explanation:'先确认客户需求。'},{id:'q2',type:'multiple',title:'需要了解哪些信息？',options:[{id:'A',text:'预算'},{id:'B',text:'使用人数'},{id:'C',text:'手机壳颜色'}],answers:['A','B'],points:40,explanation:'预算和人数影响方案选择。'},{id:'q3',type:'fill',title:'确认使用场景和______。',options:[],answers:['预算'],points:20,explanation:'预算是重要约束。'}];
      for(const q of questions)await tx.query('INSERT INTO questions(id,tenant_id,course_id,data) VALUES($1,$2,$3,$4)',[`${c.id}-${q.id}`,c.tenantId,c.id,JSON.stringify({...q,id:`${c.id}-${q.id}`,courseId:c.id})]);
      await tx.query("UPDATE course_versions SET content=jsonb_set(content,'{questions}',$3::jsonb) WHERE tenant_id=$1 AND course_id=$2",[c.tenantId,c.id,JSON.stringify(questions.map(q=>({...q,id:`${c.id}-${q.id}`,courseId:c.id})))]);
    }
    return true;
  });
  if(created&&!config.adminPassword){await mkdir(config.dataDir,{recursive:true});await writeFile(join(config.dataDir,'bootstrap-credentials.txt'),`首次启动账号（请登录后修改密码）\n邮箱：${config.adminEmail}\n密码：${password}\n`,{mode:0o600});}
}
