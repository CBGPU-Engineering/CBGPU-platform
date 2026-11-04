import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire}from'node:module';
const require=createRequire(import.meta.url),{createDemoServer}=require('../demo/server.cjs'),fixture=require('../demo/fixtures.cjs');
test('isolated demo supports real contract flow and denies real/privileged operations',async()=>{
 const server=createDemoServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const call=async(path,token,body)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+(token||''),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}};
 try{
 assert.equal((await call('/api/study/student')).status,401);
 assert.equal((await call('/auth/v1/token','',{email:'real@example.org',password:'wrong'})).status,400);
 const auth=await call('/auth/v1/token','',{email:fixture.users[0].email,password:fixture.password});assert.equal(auth.status,200);const token=auth.data.access_token;
 assert.equal((await call('/api/study/student',token)).data.code,'school_connection_required');
 await call('/api/study/student',token,{action:'remember',accessToken:fixture.schoolToken});
 const context=await call('/api/study/student',token);assert.equal(context.data.open,true);assert.equal(context.data.student.name,'Demo Student');
 const applied=await call('/api/study/student',token,{action:'apply',date:context.data.date,roomId:1,seatId:1,teacherId:'demo-teacher',period:1,reason:'Synthetic application'});assert.equal(applied.status,200);assert.equal(applied.data.entries.length,1);
 const other=await call('/auth/v1/token','',{email:fixture.users[1].email,password:fixture.password});assert.equal((await call('/api/study/student',other.data.access_token)).status,401);
 const cancelled=await call('/api/study/student',token,{action:'cancel',date:context.data.date,id:applied.data.entries[0].id});assert.equal(cancelled.data.entries.length,0);
 assert.equal((await call('/api/deploy/projects',token,{action:'deploy'})).status,501);
 assert.equal((await call('/api/contact',token,{message:'never sent'})).status,501);
 assert.equal((await call('/auth/v1/recover','',{email:'real@example.org'})).status,501);
 const profile=await call('/rest/v1/profiles?id=eq.'+fixture.users[0].id,token);assert.equal(profile.data[0].is_admin,false);
 }finally{await new Promise(r=>server.close(r))}
});

test('demo child processes do not inherit production service credentials',async()=>{
 const {demoEnvironment}=await import('../demo/environment.mjs');
 const env=demoEnvironment({PATH:'/usr/bin',HOME:'/tmp/demo',RESEND_API_KEY:'real-mail-secret',GITHUB_TOKEN:'real-github-secret',SUPABASE_SERVICE_ROLE_KEY:'real-database-secret',NODE_OPTIONS:'--require unsafe.js'});
 assert.equal(env.PATH,'/usr/bin');assert.equal(env.RESEND_API_KEY,undefined);assert.equal(env.GITHUB_TOKEN,undefined);assert.equal(env.NODE_OPTIONS,undefined);assert.equal(env.SUPABASE_SERVICE_ROLE_KEY,'demo-only-not-a-real-key');
});
