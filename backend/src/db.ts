import { mkdir } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { PGlite } from '@electric-sql/pglite';
export type Row=Record<string,any>;
export interface Queryable {query<T extends Row=Row>(sql:string,params?:unknown[]):Promise<{rows:T[]}>;}
export interface Database extends Queryable {exec(sql:string):Promise<void>;transaction<T>(fn:(tx:Queryable)=>Promise<T>):Promise<T>;close():Promise<void>;kind:'postgres'|'pglite';}
export async function openDatabase(url?:string,dir?:string):Promise<Database> {
  if(url){const pool=new Pool({connectionString:url,max:10,connectionTimeoutMillis:10000});await pool.query('SELECT 1');return {kind:'postgres',query:async(sql,params)=>pool.query(sql,params),exec:async sql=>{await pool.query(sql);},transaction:async fn=>{const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(client as PoolClient);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}},close:()=>pool.end()};}
  if(dir)await mkdir(dir,{recursive:true});
  const engine=new PGlite(dir);await engine.waitReady;
  return {kind:'pglite',query:(sql,params)=>engine.query(sql,params),exec:async sql=>{await engine.exec(sql);},transaction:fn=>engine.transaction(tx=>fn({query:(sql,params)=>tx.query(sql,params)})),close:()=>engine.close()};
}
