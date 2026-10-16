/** Business envelope around the upstream MAIC document. Scenes are validated by the backend DSL boundary. */
export type ClassroomDocument={
 dslVersion:string;
 stage:{id:string;name:string;createdAt:number;updatedAt:number;description?:string};
 scenes:unknown[];
};
export type SceneState={actionIndex:number;answers:Record<string,string[]>;submitted:boolean;notes:Record<string,string>};
export function sceneCompletion(scene:any,state:SceneState):{complete:boolean;hint:string}{
 if(scene?.type==='quiz'){
  const questions=scene.content?.questions||[];
  const complete=questions.length>0&&state.submitted&&questions.every((question:any)=>state.answers[question.id]?.some(value=>value.trim()));
  return {complete,hint:complete?'':'请先回答并提交课内练习'};
 }
 if(scene?.type==='pbl'){
  const milestones=scene.content?.projectV2?.milestones||[];
  const complete=milestones.length>0&&milestones.every((milestone:any)=>state.notes[milestone.id]?.trim());
  return {complete,hint:complete?'':'请先填写每个阶段的学习成果'};
 }
 return {complete:true,hint:''};
}
