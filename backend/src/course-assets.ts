import {randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import type {FastifyInstance} from 'fastify';
import type {Database,Queryable} from './db.ts';
import type {Config} from './config.ts';
import {requireTenant,requireContent} from './auth.ts';
import {id} from './schemas.ts';
import {bad,conflict,missing,HttpError} from './errors.ts';
import {getCourse,mutate} from './store.ts';
import {accessible} from './learning.ts';
import {courseAssetIds,normalizeAssetDocument} from '../../shared/course-assets.ts';

export function mediaType(name:string,bytes:Buffer){
 const ext=name.split('.').pop()?.toLowerCase();let mime='';
 if(ext==='png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
 if(['jpg','jpeg'].includes(ext||'')&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';
 if(ext==='gif'&&/^GIF8[79]a$/.test(bytes.subarray(0,6).toString()))mime='image/gif';
 if(ext==='webp'&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')mime='image/webp';
 if(ext==='wav'&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WAVE')mime='audio/wav';
 if(ext==='mp3'&&(bytes.subarray(0,3).toString()==='ID3'||bytes[0]===255&&(bytes[1]&224)===224))mime='audio/mpeg';
 if(ext==='ogg'&&bytes.subarray(0,4).toString()==='OggS'&&/OpusHead|vorbis/.test(bytes.subarray(0,256).toString('latin1')))mime='audio/ogg';
 if(ext==='mp4'&&bytes.subarray(4,8).toString()==='ftyp')mime='video/mp4';
 if(ext==='webm'&&bytes.subarray(0,4).equals(Buffer.from([26,69,223,163]))&&bytes.subarray(0,1024).includes(Buffer.from('webm')))mime='video/webm';
 if(!mime||bytes.length<12)throw bad('素材格式不支持或内容与扩展名不符；可上传PNG/JPEG/GIF/WebP、MP3/WAV/OGG、MP4/WebM。');
 return {mime,ext:ext!};
}
export async function validateCourseAssets(tx:Queryable,tenantId:string,courseId:string,document:unknown){
 const ids=courseAssetIds(document);
 for(const assetId of ids)if(!(await tx.query('SELECT 1 FROM course_assets WHERE tenant_id=$1 AND course_id=$2 AND id=$3',[tenantId,courseId,assetId])).rows.length)throw bad('素材不存在或不属于当前企业和课程');
 return {ids,document:normalizeAssetDocument(document)};
}
const mapAsset=(row:any)=>({id:row.id,name:row.name,mime:row.mime,ext:row.ext,size:row.size,src:`/api/admin/course-assets/${row.id}`});
export async function registerCourseAssets(app:FastifyInstance,db:Database,config:Config){
 const base='/api/tenants/:tenantId/courses/:id/assets';
 app.get(base,async req=>{const actor=requireTenant(req);requireContent(actor);const courseId=id.parse((req.params as any).id);await getCourse(db,actor.tenantId,courseId);return {items:(await db.query('SELECT * FROM course_assets WHERE tenant_id=$1 AND course_id=$2 ORDER BY created_at DESC,id',[actor.tenantId,courseId])).rows.map(mapAsset)};});
 app.post(base,async req=>{
  const actor=requireTenant(req);requireContent(actor);const courseId=id.parse((req.params as any).id);const course=await getCourse(db,actor.tenantId,courseId);if(course.status==='archived')throw bad('请先恢复课程');
  const file=await req.file();if(!file)throw bad('请选择素材文件');const bytes=await file.toBuffer();const name=file.filename.split(/[\\/]/).pop()!.replace(/[\x00-\x1f\x7f]/g,'_').slice(0,200);const type=mediaType(name,bytes);
  const assetId=randomUUID(),key=`${actor.tenantId}/${assetId}`,path=join(config.dataDir,'assets',key);await mkdir(join(config.dataDir,'assets',actor.tenantId),{recursive:true});await writeFile(path,bytes,{flag:'wx'});
  try{return await mutate(db,actor,req.headers['if-match'],'上传课程素材',name,async tx=>{const current=await getCourse(tx,actor.tenantId,courseId);if(current.status==='archived')throw conflict('课程已归档');const row=(await tx.query('INSERT INTO course_assets(id,tenant_id,course_id,name,mime,ext,size,file_key,sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[assetId,actor.tenantId,courseId,name,type.mime,type.ext,bytes.length,key,createHash('sha256').update(bytes).digest('hex')])).rows[0];return mapAsset(row);});}
  catch(e){await unlink(path).catch(()=>{});throw e;}
 });
 for(const client of ['admin','learn'])app.get(`/api/${client}/course-assets/:id`,async(req,reply)=>{
  const actor=req.actor!;if(client==='admin')requireContent(actor);
  const asset=(await db.query('SELECT * FROM course_assets WHERE tenant_id=$1 AND id=$2',[actor.tenantId,id.parse((req.params as any).id)])).rows[0];if(!asset)throw missing();
  if(client==='learn'){
   const refs=(await db.query('SELECT course_id,course_version FROM course_asset_refs WHERE tenant_id=$1 AND asset_id=$2 ORDER BY course_version DESC',[actor.tenantId,asset.id])).rows;let allowed=false;
   for(const ref of refs){try{await accessible(db,actor,ref.course_id,ref.course_version);allowed=true;break;}catch(e){if(![403,404].includes((e as any).status))throw e;}}
   if(!allowed)throw missing();
  }
  let bytes:Buffer;try{bytes=await readFile(join(config.dataDir,'assets',asset.file_key));}catch{throw new HttpError(503,'ASSET_UNAVAILABLE','素材文件暂不可用，请联系管理员');}
  reply.header('content-type',asset.mime).header('cache-control','private, no-store').header('accept-ranges','bytes').header('x-content-type-options','nosniff');
  const range=req.headers.range;
  if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);let start=0,end=bytes.length-1;
   if(match){if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),end);}else if(match[2])start=Math.max(0,bytes.length-Number(match[2]));}
   if(!match||!match[1]&&!match[2]||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=bytes.length||!match[1]&&Number(match[2])===0)return reply.code(416).header('content-range',`bytes */${bytes.length}`).send();
   return reply.code(206).header('content-range',`bytes ${start}-${end}/${bytes.length}`).header('content-length',end-start+1).send(bytes.subarray(start,end+1));
  }
  return reply.header('content-length',bytes.length).send(bytes);
 });
}
