import { DSL_VERSION, validateScene, validateStage } from '@openmaic/dsl';
import { z } from 'zod';
import type { ClassroomDocument } from '../../shared/classroom.ts';

export function validClassroom(value:unknown):value is ClassroomDocument{
 if(!value||typeof value!=='object')return false;
 const document=value as ClassroomDocument;
 if(document.dslVersion!==DSL_VERSION||!validateStage(document.stage).valid||!Array.isArray(document.scenes)||document.scenes.length<1||document.scenes.length>100)return false;
 const ids=new Set<string>();
 for(const unknownScene of document.scenes){
  if(!validateScene(unknownScene).valid)return false;
  const scene=unknownScene as any;
  if(!/^[\w-]{1,128}$/.test(scene.id)||ids.has(scene.id)||scene.stageId!==document.stage.id)return false;
  ids.add(scene.id);
  if(scene.type==='slide'){
   const canvas=scene.content.canvas;
   if(!Array.isArray(canvas.elements)||canvas.elements.length>1000||!Number.isFinite(canvas.viewportSize)||canvas.viewportSize<=0||!Number.isFinite(canvas.viewportRatio)||canvas.viewportRatio<=0)return false;
  }
 }
 return Buffer.byteLength(JSON.stringify(value))<=1500000;
}
export const classroomSchema=z.custom<ClassroomDocument>(validClassroom,'课堂文档不符合当前 OpenMAIC DSL，或超过大小限制');
