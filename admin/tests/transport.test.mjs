import test from 'node:test';
import assert from 'node:assert/strict';
import {AdminTransport} from '../src/transport.ts';
const user={id:'admin',tenantId:'enterprise',memberId:'member'};
const response=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const error=(status,code)=>response(status,{error:{code,message:code}});
function setup(sequence){const calls=[];let expired=0;const transport=new AdminTransport({fetch:async(url,init)=>{calls.push({url,init});const next=sequence.shift();assert.ok(next,'unexpected replay');return typeof next==='function'?next():next;},onExpired:()=>expired++});transport.setSession(user,'old');return {transport,calls,expired:()=>expired};}
test('same identity recovers CSRF once, preserving body, revision and idempotency key',async()=>{
 const s=setup([error(403,'CSRF_REFUSED'),response(200,{user,csrf:'fresh'}),response(200,{ok:true})]);
 await s.transport.request('/tenants/enterprise/questions','POST',{title:'题目'},{'if-match':'17','idempotency-key':'command'});
 assert.equal(s.calls.length,3);const [first,,last]=s.calls;
 assert.equal(first.init.headers['x-ola-context'],'admin:enterprise:member');assert.equal(last.init.headers['x-csrf-token'],'fresh');
 assert.equal(first.init.body,last.init.body);assert.equal(last.init.headers['if-match'],'17');assert.equal(last.init.headers['idempotency-key'],'command');assert.equal(s.expired(),0);
});
for(const field of ['id','tenantId','memberId'])test(`changed ${field} never replays`,async()=>{
 const s=setup([error(403,'CSRF_REFUSED'),response(200,{user:{...user,[field]:'different'},csrf:'fresh'})]);
 await assert.rejects(s.transport.request('/write','POST',{}),{code:'SESSION_CHANGED'});assert.equal(s.calls.length,2);assert.equal(s.expired(),1);assert.equal(s.transport.context,'');
});
for(const [status,code] of [[403,'FORBIDDEN'],[403,'SESSION_CHANGED'],[409,'VERSION_CONFLICT'],[500,'INTERNAL']])test(`${code} is not retried`,async()=>{
 const s=setup([error(status,code)]);await assert.rejects(s.transport.request('/write','POST',{}),{code});assert.equal(s.calls.length,1);
});
test('network errors do not replay possibly committed writes',async()=>{
 const s=setup([()=>{throw new TypeError('network lost');}]);await assert.rejects(s.transport.request('/write','POST',{}),TypeError);assert.equal(s.calls.length,1);
});
test('second CSRF rejection stops and missing context cannot authorize recovery',async()=>{
 const s=setup([error(403,'CSRF_REFUSED'),response(200,{user,csrf:'fresh'}),error(403,'CSRF_REFUSED')]);
 await assert.rejects(s.transport.request('/write','POST',{}),{code:'CSRF_REFUSED'});assert.equal(s.calls.length,3);
 const absent=setup([error(403,'CSRF_REFUSED')]);absent.transport.clear();await assert.rejects(absent.transport.request('/write','POST',{}),{code:'SESSION_REQUIRED'});assert.equal(absent.calls.length,0);
});
test('recovery cannot replace a newer local session or replay its old payload',async()=>{
 let resolve;const wait=new Promise(r=>resolve=r);const s=setup([error(403,'CSRF_REFUSED'),()=>wait]);
 const pending=s.transport.request('/write','POST',{});await new Promise(r=>setTimeout(r,0));
 s.transport.setSession({...user,id:'new-admin'},'new-token');resolve(response(200,{user,csrf:'fresh'}));
 await assert.rejects(pending,{code:'SESSION_CHANGED'});assert.equal(s.calls.length,2);assert.equal(s.transport.csrf,'new-token');assert.equal(s.expired(),0);
});
test('multipart upload and raw download remain supported',async()=>{
 const s=setup([error(403,'CSRF_REFUSED'),response(200,{user,csrf:'fresh'}),response(200,{ok:true}),new Response('file')]);
 const form=new FormData();form.append('file',new Blob(['test']),'test.txt');await s.transport.request('/upload','POST',form);
 assert.equal(s.calls[0].init.body,form);assert.equal(s.calls[2].init.body,form);assert.equal(s.calls[2].init.headers['content-type'],undefined);
 assert.equal(await (await s.transport.request('/download','GET',undefined,{},true)).text(),'file');
});
test('expired recovery logs out but invalid login does not expire current UI',async()=>{
 const s=setup([error(403,'CSRF_REFUSED'),error(401,'UNAUTHENTICATED')]);await assert.rejects(s.transport.request('/write','POST',{}));assert.equal(s.expired(),1);
 const login=setup([error(401,'INVALID_CREDENTIAL')]);await assert.rejects(login.transport.request('/auth/login','POST',{}));assert.equal(login.expired(),0);
});
