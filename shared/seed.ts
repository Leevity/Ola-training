import type { Course, Database, Kind } from './domain.ts';
const stamp = '2026-10-15T02:30:00.000Z';
const templates: {title:string; kind:Kind; category:string; cover:string; summary:string}[] = [
  {title:'新客接待与需求识别',kind:'learn',category:'客户服务',cover:'course-prompting.webp',summary:'从接待开场到需求确认，掌握清晰的客户服务节奏。'},
  {title:'家庭宽带异议处理',kind:'learn',category:'营销拓展',cover:'course-analysis.webp',summary:'理解客户顾虑，建立有效沟通并推荐合适的家庭宽带方案。'},
  {title:'新客接待模拟训练',kind:'train',category:'客户服务',cover:'ai-training-cover.jpg',summary:'在真实业务场景中练习需求探询、方案推荐和客户回应。'},
  {title:'业务知识阶段测评',kind:'exam',category:'业务办理',cover:'course-communication.webp',summary:'检验岗位课程学习成果，完成业务知识阶段测评。'},
  {title:'客户咨询标准话术跟读',kind:'train',category:'客户服务',cover:'follow-read-cover.jpg',summary:'听、读、说结合，练习自然清晰的标准服务表达。'},
  {title:'5G 套餐产品演练',kind:'learn',category:'业务办理',cover:'course-communication.webp',summary:'熟悉产品权益，结合使用场景介绍适合客户的方案。'},
  {title:'业务汇报演讲训练',kind:'train',category:'综合素养',cover:'course-prompting.webp',summary:'围绕业务目标与数据，用结构化表达讲清楚工作重点。'},
];
export function seedDatabase(): Database {
  const tenants = [{id:'fujian',name:'福建福宝通信有限公司',shortName:'福建福宝',departments:['市场部','客户服务部','营业中心','综合管理部'],description:'面向营业与客户服务团队的岗位能力培训。'},{id:'haichuan',name:'海川科技有限公司',shortName:'海川科技',departments:['产品部','技术部','运营部'],description:'面向产品与运营团队的业务能力培训。'}];
  const courses: Course[] = tenants.flatMap((tenant,ti)=>templates.slice(0,ti ? 3 : 7).map((c,i)=>({...c,id:`${tenant.id}-c${i}`,tenantId:tenant.id,status:i===5?'draft':i===6?'archived':'published',cover:`/assets/${c.cover}`,duration:20+i*2,lessons:[{id:`lesson-${i}`,title:'认识客户需求',format:'文档',content:'使用开放式问题了解客户的使用人数、主要场景和预算，再复述确认需求。'}],knowledgeIds:[],trainingMode:i===4?'跟读训练':'人机训练',role:'咨询家庭宽带的客户',objective:'确认使用场景、预算和家庭人数，给出匹配的解决方案。',rubric:'需求确认 40%；表达清晰 30%；方案匹配 30%。',examPass:80,examMinutes:30,examAttempts:3,version:1,updatedAt:stamp})));
  const members = tenants.flatMap(tenant=>['林雨欣','陈明轩','张雅琪','王志远','刘子墨','赵思瑶','黄嘉宁','周启航'].map((name,i)=>({id:`${tenant.id}-m${i}`,tenantId:tenant.id,name,employeeNo:`EMP${1001+i}`,department:tenant.departments[i%tenant.departments.length],role:i===0?'企业管理员':i===1?'部门管理员':'学员',active:i!==7})));
  const tasks = tenants.flatMap(tenant=>[{id:`${tenant.id}-t1`,tenantId:tenant.id,title:'新员工岗位能力提升任务',description:'完成基础服务课程、情景对练与业务测评。',start:'2026-10-12',due:'2026-10-31',status:'published' as const,sequential:true,courseIds:[`${tenant.id}-c0`,`${tenant.id}-c2`],memberIds:members.filter(m=>m.tenantId===tenant.id&&m.active).map(m=>m.id),snapshot:courses.filter(c=>c.tenantId===tenant.id&&[`${tenant.id}-c0`,`${tenant.id}-c2`].includes(c.id)).map(c=>({id:c.id,title:c.title,kind:c.kind,version:c.version})),assignedAt:stamp,completedMemberIds:[]},{id:`${tenant.id}-t2`,tenantId:tenant.id,title:'客户服务专项提升',description:'加强需求识别与异议处理能力。',start:'2026-10-18',due:'2026-11-10',status:'draft' as const,sequential:false,courseIds:[`${tenant.id}-c0`],memberIds:[],snapshot:[],completedMemberIds:[]}]);
  return {schemaVersion:1,tenants,courses,members,tasks,knowledge:tenants.map(t=>({id:`${t.id}-k1`,tenantId:t.id,name:'客户服务标准话术.md',category:'服务规范',size:1536,mime:'text/markdown',status:'ready',text:'# 客户服务标准话术\n\n您好，欢迎光临。请问有什么可以帮您？\n\n请问您的主要使用场景和预算是多少？\n\n我确认一下您的需求，再为您推荐合适的方案。',hasBlob:false,updatedAt:stamp})),audit:tenants.map(t=>({id:`${t.id}-a1`,tenantId:t.id,action:'初始化示例数据',target:'课程、任务与组织成员',at:stamp}))};
}
