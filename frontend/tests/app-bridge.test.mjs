import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validHostRequest,installAppBridge,requestAppDownload} from '../src/app-bridge.ts';
test('App协议拒绝未知版本、类型、无效ID和外部路由',()=>{
 const request={version:1,requestId:'request_1',type:'navigate',payload:{path:'/tasks'}};
 assert(validHostRequest(request));assert(!validHostRequest({...request,version:2}));assert(!validHostRequest({...request,type:'evaluate'}));assert(!validHostRequest({...request,requestId:'bad id'}));assert(!validHostRequest({...request,payload:{path:'https://evil.example'}}));assert(!validHostRequest({...request,payload:{path:'//evil.example'}}));assert(!validHostRequest({...request,payload:{path:'/a'.repeat(3000)}}));
});
test('App宿主握手、导航、返回根页、退出及清理按v1协议工作',async()=>{
 const events=[],listeners=new Map();let back=0,refresh=0,logout=0;
 globalThis.window={OlaTrainingHost:{postMessage:value=>events.push(JSON.parse(value))}};
 globalThis.location={hash:'#/home'};globalThis.history={state:{},replaceState(value){this.state=value;},back(){back++;}};
 globalThis.addEventListener=(name,callback)=>listeners.set(name,callback);globalThis.removeEventListener=(name)=>listeners.delete(name);
 const cleanup=installAppBridge({navigate:path=>{location.hash='#'+path;history.state=null;listeners.get('hashchange')();},refresh:async()=>{refresh++;},logout:async()=>{logout++;}});
 assert.equal(events[0].type,'ready');assert.equal(events[0].version,1);
 await window.olaTrainingReceive({version:1,requestId:'open',type:'navigate',payload:{path:'/tasks'}});assert.equal(location.hash,'#/tasks');assert.equal(history.state.olaDepth,1);
 await window.olaTrainingReceive({version:1,requestId:'back',type:'back'});assert.equal(back,1);
 history.state={olaDepth:0};location.hash='#/home';listeners.get('hashchange')();
 await window.olaTrainingReceive({version:1,requestId:'root',type:'back'});assert.equal(back,1);assert(events.some(event=>event.type==='back-at-root'&&event.requestId==='root'));
 await window.olaTrainingReceive({version:1,requestId:'refresh',type:'refresh'});await window.olaTrainingReceive({version:1,requestId:'logout',type:'logout'});assert.equal(refresh,1);assert.equal(logout,1);
 assert(events.some(event=>event.type==='result'&&event.requestId==='logout'&&event.payload.ok));cleanup();assert.equal(window.olaTrainingReceive,undefined);assert.equal(listeners.size,0);
});


test('App下载显式启用并匹配宿主结果，拒绝外部路径且不传递凭据',async()=>{
 const events=[],listeners=new Map();globalThis.window={OlaTrainingHost:{postMessage:value=>events.push(JSON.parse(value))},olaTrainingHostCapabilities:['download']};globalThis.location={hash:'#/home'};globalThis.history={state:{},replaceState(value){this.state=value;},back(){}};globalThis.addEventListener=(name,callback)=>listeners.set(name,callback);globalThis.removeEventListener=name=>listeners.delete(name);
 const cleanup=installAppBridge({navigate:()=>{},refresh:async()=>{},logout:async()=>{}});assert(events[0].payload.capabilities.includes('download'));
 const file={path:'/api/learn/knowledge/file-a/download',filename:'资料.docx',context:'account:enterprise:member'};
 await assert.rejects(requestAppDownload({...file,path:'https://evil.example/file'}));await assert.rejects(requestAppDownload({...file,filename:'../file.docx'}));assert.equal(events.filter(event=>event.type==='download').length,0);
 const success=requestAppDownload(file);const sent=events.at(-1);assert.equal(sent.type,'download');assert.deepEqual(Object.keys(sent.payload).sort(),['context','filename','path']);assert.deepEqual(sent.payload,file);
 assert(!validHostRequest({version:1,requestId:sent.requestId,type:'download-result',payload:{ok:'yes'}}));await window.olaTrainingReceive({version:1,requestId:sent.requestId,type:'download-result',payload:{ok:true}});await success;
 const failure=requestAppDownload(file),failed=assert.rejects(failure,/空间不足/);const failedId=events.at(-1).requestId;await window.olaTrainingReceive({version:1,requestId:sent.requestId,type:'download-result',payload:{ok:true}});await window.olaTrainingReceive({version:1,requestId:failedId,type:'download-result',payload:{ok:false,message:'空间不足'}});await failed;
 const pending=requestAppDownload(file),cancelled=assert.rejects(pending,/页面已关闭/);cleanup();await cancelled;assert.equal(window.olaTrainingDownload,undefined);
});
test('未接入下载能力的App给出明确错误，iOS下载协议同样等待结果',async()=>{
 const events=[];globalThis.window={webkit:{messageHandlers:{olaTraining:{postMessage:event=>events.push(event)}}}};globalThis.location={hash:'#/home'};globalThis.history={state:{},replaceState(value){this.state=value;},back(){}};globalThis.addEventListener=()=>{};globalThis.removeEventListener=()=>{};
 let cleanup=installAppBridge({navigate:()=>{},refresh:async()=>{},logout:async()=>{}});await assert.rejects(requestAppDownload({path:'/api/learn/knowledge/f/download',filename:'f.txt',context:'a:b:c'}),/尚未接入/);cleanup();window.olaTrainingHostCapabilities=['download'];cleanup=installAppBridge({navigate:()=>{},refresh:async()=>{},logout:async()=>{}});const done=requestAppDownload({path:'/api/learn/knowledge/f/download',filename:'f.txt',context:'a:b:c'});const request=events.at(-1);await window.olaTrainingReceive({version:1,type:'download-result',requestId:request.requestId,payload:{ok:true}});await done;cleanup();
});
test('App返回和导航取消时回传失败结果，不发送返回根页或执行导航',async()=>{
 const events=[],listeners=new Map();let back=0;
 globalThis.window={OlaTrainingHost:{postMessage:value=>events.push(JSON.parse(value))}};globalThis.location={hash:'#/content/course'};globalThis.history={state:{},replaceState(value){this.state=value;},back(){back++;}};globalThis.addEventListener=(name,callback)=>listeners.set(name,callback);globalThis.removeEventListener=name=>listeners.delete(name);
 const cleanup=installAppBridge({navigate:()=>false,beforeBack:()=>false,refresh:async()=>{},logout:async()=>{throw new Error('cancelled');}});
 try{for(const type of ['back','navigate','logout'])await window.olaTrainingReceive({version:1,requestId:'cancel_'+type,type,...(type==='navigate'?{payload:{path:'/tasks'}}:{})});assert.equal(back,0);assert.equal(location.hash,'#/content/course');assert(!events.some(event=>event.type==='back-at-root'));assert.equal(events.filter(event=>event.type==='result'&&!event.payload.ok).length,3);}finally{cleanup();}
});
test('App导航通知在页面守卫之后读取地址，取消后不误报离开且清理后不发消息',async()=>{
 const events=[],listeners=new Map();globalThis.window={OlaTrainingHost:{postMessage:value=>events.push(JSON.parse(value))}};globalThis.location={hash:'#/content/course'};globalThis.history={state:{},replaceState(value){this.state=value;},back(){}};globalThis.addEventListener=(name,callback)=>listeners.set(name,callback);globalThis.removeEventListener=name=>listeners.delete(name);
 const cleanup=installAppBridge({navigate:()=>{},beforeBack:()=>false,refresh:async()=>{},logout:async()=>{}});
 history.state={olaDepth:3};location.hash='#/tasks';listeners.get('hashchange')();
 // The route guard restores the accepted URL synchronously before host notification.
 location.hash='#/content/course';history.state={olaDepth:3};await Promise.resolve();assert.equal(events.at(-1).type,'navigation');assert.equal(events.at(-1).payload.path,'/content/course');
 listeners.get('hashchange')();const before=events.length;cleanup();await Promise.resolve();assert.equal(events.length,before);
});
