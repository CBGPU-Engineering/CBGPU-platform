import {NextRequest,NextResponse} from 'next/server';
import net from 'node:net';
import {readFile} from 'node:fs/promises';
import {publicationUser,preprintsClient} from '@/lib/preprintsServer';
import {activeDeploymentSession} from '@/lib/deployAuth';
import {WindowRateLimiter} from '@/lib/requestSecurity';
const limits=new WindowRateLimiter(120,60000),ipLimits=new WindowRateLimiter(240,60000),inviteLimits=new WindowRateLimiter(15,60000);
export const runtime='nodejs';
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const error=(message:string,status:number)=>NextResponse.json({message},{status,headers:{'Cache-Control':'no-store'}});
async function backend(parts:string[],owner:string,method='GET',body?:unknown,resourceOwner?:string){const key=(await readFile('/home/cbgpu/CBGPU-live/backend/private/frontend-deploy-key')).toString('hex');return fetch('http://127.0.0.1:3510/'+parts.join('/'),{method,headers:{Host:'deploy.internal','x-cbgpu-deploy-key':key,'x-cbgpu-owner':owner,'content-type':'application/json',...(resourceOwner?{'x-cbgpu-resource-owner':resourceOwner}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(20000)})}
async function forward(response:Response){return new NextResponse(await response.text(),{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}
function publicCPU(project:Record<string,unknown>,role:string){if(role==='viewer'){const values=project.env_vars as Record<string,string>||{};project={...project,env_vars:Object.fromEntries(Object.entries(values).filter(([key])=>['CBGPU_RUNTIME_PRESET','CBGPU_ROOT_DIRECTORY','CBGPU_DEPLOY_ENGINE','CBGPU_COMPOSE_FILE','CBGPU_GATEWAY_SERVICE','CBGPU_STORAGE_GB'].includes(key))),environment_keys:Object.keys(values).filter(key=>!key.startsWith('CBGPU_'))};if(typeof project.git_url==='string')try{const url=new URL(project.git_url);url.username='';url.password='';project.git_url=url.href}catch{project.git_url=null}}return{...project,collaboration_role:role}}
function invalidEngine(env:Record<string,string>,previous?:Record<string,string>){
 if(previous&&(env.CBGPU_DEPLOY_ENGINE||'git')!==(previous.CBGPU_DEPLOY_ENGINE||'git'))return '배포 방식은 새 프로젝트에서 변경해 주세요.';
 if(env.CBGPU_DEPLOY_ENGINE&&env.CBGPU_DEPLOY_ENGINE!=='compose')return '지원하지 않는 배포 방식입니다.';
 if(env.CBGPU_RUNTIME_PRESET&&!['node22','node20','node18','python312','python311','python39','java21','java17','go1','dotnet10'].includes(env.CBGPU_RUNTIME_PRESET))return '런타임 설정을 확인해 주세요.';
 if(env.CBGPU_DEPLOY_ENGINE==='compose'){
  const storage=Number(env.CBGPU_STORAGE_GB||40);if(!Number.isInteger(storage)||storage<40||storage>200)return '영구 저장공간은 40~200GB로 설정해 주세요.';
  const file=env.CBGPU_COMPOSE_FILE||'';if(file&&(file.length>200||file.startsWith('/')||file.includes('\\')||file.split('/').includes('..')||/[\0\r\n]/.test(file)))return 'Compose 파일 경로를 확인해 주세요.';
  if(env.CBGPU_GATEWAY_SERVICE&&!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(env.CBGPU_GATEWAY_SERVICE))return '게이트웨이 서비스 이름을 확인해 주세요.';
 }return null;
}
async function handle(request:NextRequest,context:{params:Promise<{path:string[]}>}){
 const host=request.headers.get('x-cbgpu-public-host')||request.headers.get('host')||'';
 if(!['developer.cbgpu.com','app.cbgpu.com','cbgpu.com','localhost:3002','127.0.0.1:3002'].includes(host))return error('Not found',404);
 if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==`https://${host}`&&!host.startsWith('localhost:')&&!host.startsWith('127.0.0.1:'))return error('Invalid request origin',403);
 if(!ipLimits.allow(request.headers.get('cf-connecting-ip')||'local'))return error('요청이 많습니다. 잠시 후 다시 시도해 주세요.',429);
 let user;try{user=await publicationUser(request)}catch{return error('Authentication unavailable',503)}if(!user)return error('로그인과 계정 승인이 필요합니다.',401);if(!limits.allow(user.id))return error('요청이 많습니다. 잠시 후 다시 시도해 주세요.',429);try{if(!await activeDeploymentSession(request,user.id))return error('로그인 세션이 종료됐습니다. 다시 로그인해 주세요.',401)}catch{return error('세션을 확인하지 못했습니다.',503)}
 const {path}=await context.params;if(!['projects','servers','teams','domains','compose'].includes(path[0])||path.some(part=>!/^[-a-z0-9]+$/.test(part))||path.length>4)return error('Not found',404);
 try{
 let value:Record<string,unknown>|undefined;
 if(!['GET','HEAD'].includes(request.method)){const chunks:Uint8Array[]=[];let length=0;const reader=request.body?.getReader();if(reader)while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>65536){await reader.cancel();return error('Request too large',413)}chunks.push(part.value)}try{value=JSON.parse(Buffer.concat(chunks).toString()||'{}')}catch{return error('Invalid JSON',400)}if(!value||Array.isArray(value)||typeof value!=='object')return error('Invalid JSON',400)}
 const client=preprintsClient();
 if(path[0]==='compose'){
  if(path.length!==2||!uuid(path[1]))return error('Not found',404);const {data}=await client.from('cpu_projects').select('id,user_id').eq('id',path[1]).neq('status','deleted').maybeSingle();if(!data)return error('Project not found',404);return forward(await backend(path,user.id,request.method,value,data.user_id));
 }
 if(path[0]==='domains'){
  if(!['frontend','server'].includes(path[1])||!uuid(path[2])||(path.length!==3&&!(path.length===4&&path[3]==='verify')))return error('Not found',404);let resourceOwner:string|undefined;if(path[1]==='server'){const {data}=await client.from('cpu_projects').select('id,user_id').eq('id',path[2]).neq('status','deleted').maybeSingle();if(!data)return error('Project not found',404);resourceOwner=data.user_id}return forward(await backend(path,user.id,request.method,value,resourceOwner));
 }
 if(path[0]==='teams'){
  const kind=path[1],id=path[2];if(!['frontend','server'].includes(kind)||!uuid(id)||path.length!==3)return error('Not found',404);let resourceOwner:string|undefined;
  if(kind==='server'){const {data}=await client.from('cpu_projects').select('id,user_id').eq('id',id).neq('status','deleted').maybeSingle();if(!data)return error('Project not found',404);resourceOwner=data.user_id}
  const permission=await backend(path,user.id,'GET',undefined,resourceOwner);if(!permission.ok)return forward(permission);const team=await permission.json();
  if(request.method==='GET'){const {data:profile}=await client.from('profiles').select('full_name').eq('id',team.owner_id).maybeSingle();const {data}=await client.auth.admin.getUserById(team.owner_id);return NextResponse.json({...team,owner:{user_id:team.owner_id,name:profile?.full_name||'Project owner',email:data.user?.email||''}},{headers:{'Cache-Control':'no-store'}})}
  if(request.method==='POST'){
   if(team.my_role!=='owner')return error('소유자만 공동작업자를 관리할 수 있습니다.',403);if(!inviteLimits.allow(user.id))return error('잠시 후 다시 추가해 주세요.',429);
   const email=String(value?.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!['editor','viewer'].includes(String(value?.role)))return error('이메일과 권한을 확인해 주세요.',400);
   const {data,error:e}=await client.auth.admin.listUsers({page:1,perPage:1000});if(e)return error('계정을 확인하지 못했습니다.',503);const target=data.users.find(account=>account.email?.toLowerCase()===email);if(!target)return error('승인된 CBGPU 계정을 찾지 못했습니다. 이메일을 확인해 주세요.',404);
   const {data:profile}=await client.from('profiles').select('id,full_name,is_approved').eq('id',target.id).maybeSingle();if(!profile||profile.is_approved===false||target.banned_until&&Date.parse(target.banned_until)>Date.now())return error('승인된 CBGPU 계정을 찾지 못했습니다.',404);
   return forward(await backend(path,user.id,'POST',{user_id:target.id,email,name:profile.full_name||email,role:value?.role},resourceOwner));
  }
  if(request.method==='DELETE'){if(!uuid(value?.user_id))return error('Invalid member',400);return forward(await backend(path,user.id,'DELETE',{user_id:value.user_id},resourceOwner))}return error('Method not allowed',405);
 }
 if(path[0]==='servers'&&path[1]==='projects'){
  if(path.length===2&&request.method==='POST'){
   const input=value||{};const type=String(input.deploy_type||'');if(!['docker','git'].includes(type)||typeof input.name!=='string'||!input.name.trim()||input.name.length>100)return error('프로젝트 이름과 배포 방식을 확인해 주세요.',400);
   const {count,error:countError}=await client.from('cpu_projects').select('id',{head:true,count:'exact'}).eq('user_id',user.id).neq('status','deleted');if(countError)return error('프로젝트 수를 확인하지 못했습니다.',503);if((count||0)>=5)return error('계정당 서버 프로젝트는 최대 5개입니다.',429);
   const cpu=Number(input.cpu_limit||1),memory=String(input.memory_limit||'512m'),scope=String(input.access_scope||'private');if(!Number.isFinite(cpu)||cpu<0.1||cpu>4||!['128m','256m','512m','1g','2g','4g'].includes(memory)||!['private','school','public'].includes(scope))return error('CPU는 0.1~4코어, RAM은 최대 4GB로 설정해 주세요.',400);
   const port=Number(input.container_port||80);if(!Number.isSafeInteger(port)||port<1||port>65535)return error('컨테이너 포트를 확인해 주세요.',400);
   if(type==='docker'&&/^(cbgpu[\/-]|cbcpu_|jupiterhub_)/.test(String(input.docker_image||'')))return error('시스템 이미지는 배포할 수 없습니다.',400);
   if(type==='docker'&&!/^[a-zA-Z0-9][a-zA-Z0-9._/:@-]{0,199}$/.test(String(input.docker_image||'')))return error('Docker 이미지 이름을 확인해 주세요.',400);
   if(type==='git'){try{const repo=new URL(String(input.git_url||''));if(repo.protocol!=='https:'||repo.hostname!=='github.com'||repo.username||repo.password||repo.port||!/^\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/.test(repo.pathname))throw Error()}catch{return error('GitHub 저장소 URL을 확인해 주세요.',400)}}
   const env=input.env_vars||{};if(typeof env!=='object'||Array.isArray(env)||Object.keys(env).length>160||Object.entries(env).some(([key,v])=>!/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(key)||typeof v!=='string'||v.length>8192))return error('환경변수를 확인해 주세요.',400);
   const entries=env as Record<string,string>,root=entries.CBGPU_ROOT_DIRECTORY;if(root&&(root.length>200||root.startsWith('/')||root.includes('\\')||root.split('/').includes('..')||/[\0\r\n]/.test(root)))return error('Root Directory를 확인해 주세요.',400);
   const engineError=invalidEngine(entries);if(engineError)return error(engineError,400);if(type==='docker'&&entries.CBGPU_DEPLOY_ENGINE)return error('Compose는 Git 저장소를 사용해 주세요.',400);if(type==='docker'&&String(input.docker_image).startsWith('nginx'))entries.NGINX_ENTRYPOINT_WORKER_PROCESSES_AUTOTUNE='1';
   const runtime=String(input.runtime||'node20');if(type==='git'&&!['node20','node18','python311','python39'].includes(runtime))return error('실행 환경을 확인해 주세요.',400);
   const branch=String(input.git_branch||'main');if(type==='git'&&(!/^[A-Za-z0-9][A-Za-z0-9_./-]{0,99}$/.test(branch)||branch.includes('..')))return error('브랜치를 확인해 주세요.',400);
   const command=String(input.run_command||'');if(command.length>4000||command.includes('\0'))return error('실행 명령을 확인해 주세요.',400);
   const autoPort=()=>new Promise<number>((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();const chosen=typeof address==='object'&&address?address.port:0;server.close(()=>chosen?resolve(chosen):reject(Error('Port unavailable')))})});
   const requested=input.host_port===null||input.host_port===undefined?null:Number(input.host_port);if(requested!==null&&(!Number.isSafeInteger(requested)||requested<1024||requested>65535))return error('호스트 포트는 1024~65535 또는 자동 할당을 사용하세요.',400);
   const settings={user_id:user.id,user_email:user.email,name:input.name.trim(),description:String(input.description||'').slice(0,2000),deploy_type:type,docker_image:type==='docker'?String(input.docker_image):null,git_url:type==='git'?String(input.git_url):null,git_branch:type==='git'?branch:null,runtime:type==='git'?runtime:null,run_command:type==='git'?command:null,container_port:port,access_scope:scope,cpu_limit:String(cpu),memory_limit:memory,env_vars:env,status:'approved',deploy_requested_at:new Date().toISOString()};
   for(let attempt=0;attempt<3;attempt++){const {data,error:e}=await client.from('cpu_projects').insert({...settings,host_port:requested||await autoPort()}).select('*').single();if(!e)return NextResponse.json({project:{...data,collaboration_role:'owner'}},{status:201,headers:{'Cache-Control':'no-store'}});if(e.code!=='23505'||requested)return error(e.code==='23505'?'이미 사용 중인 포트입니다.':'서버 프로젝트를 만들지 못했습니다.',400)}return error('사용 가능한 포트를 찾지 못했습니다.',503);
  }
  if(path.length===2&&request.method==='GET'){
   const registry=await backend(['servers'],user.id);if(!registry.ok)return forward(registry);const shared=await registry.json();const memberships=(shared.shared_project_ids||[]) as {project_id:string;role:string}[];const ids=memberships.map(member=>member.project_id).filter(uuid);
   const own=await client.from('cpu_projects').select('*').eq('user_id',user.id).neq('status','deleted').order('created_at',{ascending:false});if(own.error)return error('서버 목록을 불러오지 못했습니다.',503);const others=ids.length?await client.from('cpu_projects').select('*').in('id',ids).neq('status','deleted'):{data:[],error:null};if(others.error)return error('공유 서버 목록을 불러오지 못했습니다.',503);const result=new Map<string,Record<string,unknown>>();for(const p of [...(others.data||[]),...(own.data||[])])result.set(p.id,publicCPU(p,p.user_id===user.id?'owner':memberships.find(member=>member.project_id===p.id)?.role||'viewer'));return NextResponse.json({projects:[...result.values()].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))},{headers:{'Cache-Control':'no-store'}})
  }
  const id=path[2];if(!uuid(id)||path.length!==3)return error('Not found',404);const {data:project}=await client.from('cpu_projects').select('*').eq('id',id).neq('status','deleted').maybeSingle();if(!project)return error('Project not found',404);const permission=await backend(['teams','server',id],user.id,'GET',undefined,project.user_id);if(!permission.ok)return forward(permission);const {my_role:role}=await permission.json();if(request.method==='GET')return NextResponse.json({project:publicCPU(project,role)},{headers:{'Cache-Control':'no-store'}});if(role==='viewer')return error('보기 전용 권한입니다.',403);
  if(request.method==='DELETE'){if(role!=='owner')return error('소유자만 서버를 삭제할 수 있습니다.',403);const {error:e}=await client.from('cpu_projects').update({status:'deleted'}).eq('id',id);if(e)return error('서버 삭제에 실패했습니다.',400);return NextResponse.json({ok:true})}
  if(request.method!=='PATCH')return error('Method not allowed',405);const updates:Record<string,unknown>={};const allowed=['name','description','git_url','docker_image','git_branch','runtime','run_command','container_port','host_port','access_scope','cpu_limit','memory_limit','env_vars','deploy_requested_at'];for(const [key,v] of Object.entries(value||{})){if(!allowed.includes(key))return error('변경할 수 없는 항목입니다.',400);updates[key]=v}
  if('name'in updates&&(typeof updates.name!=='string'||!updates.name.trim()||updates.name.length>100))return error('프로젝트 이름을 확인해 주세요.',400);
  if('description'in updates&&(typeof updates.description!=='string'||updates.description.length>2000))return error('설명은 2000자 이내로 입력해 주세요.',400);
  if('git_url'in updates){if(project.deploy_type!=='git')return error('Git 배포에서만 저장소를 변경할 수 있습니다.',400);try{const repo=new URL(String(updates.git_url));if(repo.protocol!=='https:'||repo.hostname!=='github.com'||repo.username||repo.password||repo.port||!/^\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/.test(repo.pathname))throw Error()}catch{return error('GitHub 저장소 URL을 확인해 주세요.',400)}}
  for(const key of ['container_port','host_port'])if(key in updates&&(!Number.isSafeInteger(updates[key])||Number(updates[key])<1||Number(updates[key])>65535))return error('올바른 포트를 입력하세요.',400);
  if('cpu_limit'in updates&&(!Number.isFinite(Number(updates.cpu_limit))||Number(updates.cpu_limit)<0.1||Number(updates.cpu_limit)>4))return error('CPU 범위를 확인해 주세요.',400);
  if('memory_limit'in updates&&!['128m','256m','512m','1g','2g','4g'].includes(String(updates.memory_limit)))return error('메모리 설정을 확인해 주세요.',400);
  if('access_scope'in updates&&!['private','school','public'].includes(String(updates.access_scope)))return error('공개 범위를 확인해 주세요.',400);
  if('runtime'in updates&&!['node20','node18','python311','python39'].includes(String(updates.runtime)))return error('런타임을 확인해 주세요.',400);
  if('docker_image'in updates&&!/^[a-zA-Z0-9][a-zA-Z0-9._/:@-]{0,199}$/.test(String(updates.docker_image)))return error('이미지 이름을 확인해 주세요.',400);
  for(const key of ['git_branch','run_command'])if(key in updates&&(typeof updates[key]!=='string'||String(updates[key]).length>4000||String(updates[key]).includes('\0')))return error('실행 설정을 확인해 주세요.',400);
  if('env_vars'in updates){const env=updates.env_vars;if(!env||typeof env!=='object'||Array.isArray(env)||Object.keys(env).length>160||Object.entries(env).some(([key,v])=>!/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(key)||typeof v!=='string'||v.length>8192))return error('환경변수를 확인해 주세요.',400)}
  if(updates.env_vars&&typeof updates.env_vars==='object'){const env=updates.env_vars as Record<string,string>;const engineError=invalidEngine(env,project.env_vars||{});if(engineError)return error(engineError,400);if(env.CBGPU_RUNTIME_PRESET&&!['node22','node20','node18','python312','python311','python39','java21','java17','go1','dotnet10'].includes(env.CBGPU_RUNTIME_PRESET))return error('런타임 설정을 확인해 주세요.',400);const root=env.CBGPU_ROOT_DIRECTORY;if(root&&(root.startsWith('/')||root.includes('\\')||root.split('/').includes('..')||/[\0\r\n]/.test(root)))return error('Root Directory를 확인해 주세요.',400)}
  if('deploy_requested_at'in updates){updates.deploy_requested_at=new Date().toISOString();if(project.status==='pending'||project.status==='rejected')updates.status='approved';}const {error:e}=await client.from('cpu_projects').update(updates).eq('id',id);if(e)return error(e.code==='23505'?'이미 사용 중인 포트입니다.':'서버 설정을 저장하지 못했습니다.',400);return NextResponse.json({ok:true});
 }
 if(path[0]==='servers'&&['POST','DELETE'].includes(request.method)){if(!uuid(value?.project_id))return error('Invalid project',400);const {data}=await client.from('cpu_projects').select('id').eq('id',value.project_id).eq('user_id',user.id).neq('status','deleted').maybeSingle();if(!data)return error('Server project not found',404)}
 return forward(await backend(path,user.id,request.method,value));
 }catch{return error('배포 서비스를 연결하지 못했습니다.',503)}
}
export {handle as GET,handle as POST,handle as PATCH,handle as DELETE};
