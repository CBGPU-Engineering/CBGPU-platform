const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const fixtures=require('./fixtures.cjs');
// Transpile only the existing pure contract modules, never production API clients.
const ts=require('../FrontEnd/cbgpu/node_modules/typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {handleStudentStudy,StudyFailure}=require('../FrontEnd/cbgpu/src/lib/edusetStudent.ts');
function createDemoServer(){
 const data=fixtures.tables(),sessions=new Map(),connections=new Map();let records=[],sequence=1;
 function userFor(req){return sessions.get((req.headers['x-cbgpu-auth']||req.headers.authorization||'').replace(/^Bearer /,''))||null}
 const student={id:'demo-school-student',name:'Demo Student',grade:2,classNo:3,number:1};
 const rooms=[{id:1,name:'Demo study room',hasSeats:true,width:2,height:1}],teachers=[{id:'demo-teacher',name:'Demo Teacher'}];
 const composition={seats:[{id:1,x:0,y:0,name:'1'},{id:2,x:1,y:0,name:'2'}],obstacles:[]};
 const policy={timelimit:{assign:Array(7).fill({start:{h:0,m:0},end:{h:24,m:0}}),exception:{}},timetable:{assign:Array(7).fill('demo'),presets:{demo:[{},{}]},exception:{}}};
 const school=async(p,token,method='GET',body)=>{
  if(token!==fixtures.schoolToken)throw new StudyFailure('Use the synthetic demo school account.',401);
  if(p==='/users/'+student.id)return {id:student.id,role:'STUDENT'};
  if(p==='/students/'+student.id)return student;
  if(p==='/policies/selfstudy')return {data:policy};
  if(p==='/rooms')return rooms;if(p==='/teachers')return teachers;
  if(p==='/rooms/1/composition')return composition;
  if(p==='/selfstudy/search')return records;
  if(p==='/selfstudy'&&method==='POST'){const row={id:sequence++,type:'selfstudy',student,date:body.date,period:body.period,status:'PENDING',room:rooms[0],seat:{id:body.seatId,name:String(body.seatId)},teacher:teachers[0],reason:body.reason};records.push(row);return row}
  if(method==='DELETE'&&p.startsWith('/selfstudy/')){records=records.filter(r=>String(r.id)!==p.split('/').pop());return null}
  throw new StudyFailure('This school operation is not implemented in the demo.',501);
 };
 const server=http.createServer(async(req,res)=>{
  const reply=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-CBGPU-Demo':'synthetic'});res.end(JSON.stringify(value))};
  try{
   const p=new URL(req.url,'http://localhost').pathname.replace(/^\/backend/,'');let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>65536)return reply(413,{message:'Demo request too large'})}
   let body={};try{body=raw?JSON.parse(raw):{}}catch{return reply(400,{message:'Invalid JSON'})}
   if(p==='/health')return reply(200,{demo:true,persistent:false,outbound:false});
   if(p==='/auth/v1/token'&&req.method==='POST'){
    const u=fixtures.users.find(u=>body.email===u.email&&body.password===fixtures.password||body.refresh_token==='demo-refresh-'+u.id);
    if(!u)return reply(400,{error:'invalid_grant',error_description:'Use student@example.invalid or researcher@example.invalid with password demo-only.'});
    const s=fixtures.session(u);sessions.set(s.access_token,u);return reply(200,s);
   }
   const user=userFor(req);
   if(p==='/auth/v1/user')return user?reply(200,fixtures.session(user).user):reply(401,{message:'Demo login required'});
   if(p==='/auth/v1/logout'){sessions.delete((req.headers.authorization||'').replace(/^Bearer /,''));return reply(200,{})}
   if(p.startsWith('/auth/'))return reply(501,{message:'OAuth, email and account creation are disabled in the local demo.'});
   if(p==='/api/study/student'){
    const headers={...req.headers,host:'student.cbgpu.com',origin:'https://student.cbgpu.com'};
    const request=new Request('https://student.cbgpu.com/api/study/student',{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:raw});
    const result=await handleStudentStudy(request,{authorize:async()=>user?.id||null,limit:()=>true,now:()=>new Date('2026-11-03T07:00:00Z'),send:school,getConnection:async id=>connections.get(id)||null,remember:async(id,t)=>{connections.set(id,t)},disconnect:async id=>{connections.delete(id)}});
    return reply(result.status,await result.json());
   }
   if(p.startsWith('/api/study/proxy/')){
    if(!user)return reply(401,{message:'Demo login required'});
    const endpoint=p.slice('/api/study/proxy'.length);
    if(endpoint.endsWith('/composition'))return reply(200,composition);
    if(endpoint.startsWith('/policies/'))return reply(200,{data:policy});
    if(endpoint==='/rooms')return reply(200,rooms);if(endpoint==='/teachers')return reply(200,teachers);
    return reply(200,[]);
   }
   if(p==='/rest/v1/rpc/get_gpu_reservation_schedule')return reply(200,[]);
   if(p.startsWith('/rest/v1/')){
    if(!user)return reply(401,{message:'Demo login required'});
    const table=p.slice('/rest/v1/'.length);let rows=data[table]||[];
    const url=new URL(req.url,'http://localhost');
    for(const [key,value]of url.searchParams){if(value.startsWith('eq.'))rows=rows.filter(r=>String(r[key])===value.slice(3))}
    if(req.method!=='GET'&&req.method!=='HEAD')return reply(501,{message:'Table editing is outside the demo. School applications use the isolated fixture API.'});
    const single=(req.headers.accept||'').includes('vnd.pgrst.object');
    return reply(200,single?(rows[0]||null):rows);
   }
   if(p==='/api/traffic')return reply(200,{ok:true,demo:true});
   if(p==='/api/gpu-status'||p==='/functions/v1/gpu-status')return reply(200,[1,2,3,4].map(id=>({gpu_id:id,status:'idle',utilization:0,memory_used:0,demo:true})));
   if(p==='/api/deploy/projects'&&req.method==='GET')return user?reply(200,{projects:[]}):reply(401,{message:'Demo login required'});
   return reply(501,{message:'This integration is not simulated. The demo never forwards requests to a real service.',demo:true});
  }catch{return reply(500,{message:'Demo fixture error'})}
 });
 const {WebSocketServer}=require('../FrontEnd/cbgpu/node_modules/ws');
 const realtime=new WebSocketServer({noServer:true});
 server.on('upgrade',(req,socket,head)=>{if(!req.url.startsWith('/backend/realtime/'))return socket.destroy();realtime.handleUpgrade(req,socket,head,ws=>{ws.on('message',raw=>{try{const value=JSON.parse(raw.toString());if(Array.isArray(value)){const [join,ref,topic,event]=value;ws.send(JSON.stringify([join,ref,topic,'phx_reply',{status:'ok',response:event==='phx_join'?{postgres_changes:[]}:{}}]))}else if(value.event){ws.send(JSON.stringify({topic:value.topic,event:'phx_reply',ref:value.ref,payload:{status:'ok',response:{postgres_changes:[]}}}))}}catch{ws.close(1003)}})})});
 server.on('close',()=>realtime.close());return server;
}
if(require.main===module){if(process.env.CBGPU_DEMO!=='1')throw Error('Start with node scripts/demo.mjs; this server is for local fixtures only.');const port=Number(process.env.CBGPU_DEMO_API_PORT||54329);createDemoServer().listen(port,'127.0.0.1',()=>console.log('Synthetic demo API on loopback:'+port))}
module.exports={createDemoServer};
