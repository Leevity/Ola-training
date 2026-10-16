import type {Overview} from '../packages/learner-client/src/types.ts';
/** Learning history is grouped by immutable version; repeated events do not create duplicate rows. */
export function learningHistory(data:Overview){
 const groups=new Map<string,{id:string;title:string;at:string;version:number;lessons:Set<string>;total?:number;href:string}>();
 for(const progress of data.progress){
  const id=progress.courseId+':'+progress.version;
  let group=groups.get(id);
  if(!group){
   const course=data.courses.find(c=>c.id===progress.courseId&&c.version===progress.version);
   const snapshot=data.tasks.flatMap(t=>t.snapshot).find(c=>c.id===progress.courseId&&c.version===progress.version);
   group={id,title:course?.title||snapshot?.title||'历史课程',at:progress.completed_at,version:progress.version,lessons:new Set(),total:course?.lessons.length,href:`/content/${progress.courseId}?v=${progress.version}`};
   groups.set(id,group);
  }
  group.lessons.add(progress.lessonId);
  if(progress.completed_at>group.at)group.at=progress.completed_at;
 }
 return [...groups.values()].sort((a,b)=>b.at.localeCompare(a.at)).map(({lessons,total,...group})=>({...group,status:total?`${lessons.size}/${total} 课时已完成`:`已完成 ${lessons.size} 个课时`}));
}
