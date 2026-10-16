type Answers=Record<string,string[]>;
type Save=(answers:Answers,revision:number)=>Promise<{revision:number}>;
/** Serialize per-device saves; a remote conflict stops all queued writes until explicit reload. */
export class ExamAnswerWriter {
 private pending:Promise<void>=Promise.resolve();
 private conflict:Error|null=null;
 public revision:number;
 private send:Save;
 constructor(revision:number,send:Save){this.revision=revision;this.send=send;}
 get locked(){return this.conflict!==null;}
 /** Submission conflicts must freeze the same queue used by answer saves. */
 lockOnConflict(error:unknown){
  if((error as {status?:number}|null)?.status===409)this.conflict=error instanceof Error?error:new Error('答卷状态已变化，请重新加载');
 }
 save(answers:Answers):Promise<void>{
  const snapshot=structuredClone(answers);
  const work=this.pending.catch(()=>{}).then(async()=>{
   if(this.conflict)throw this.conflict;
   try{const result=await this.send(snapshot,this.revision);this.revision=result.revision;}
   catch(error){this.lockOnConflict(error);throw error;}
  });
  this.pending=work;
  return work;
 }
 drain(){return this.pending;}
}
