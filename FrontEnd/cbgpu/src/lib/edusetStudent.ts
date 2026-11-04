/** Student-only EduSet contract. No administrator/shared token is used here. */
import { readJsonBody } from './requestSecurity';
export type StudyId=string|number;
export type StudySeat = {id:StudyId;name:string;x:number;y:number};
export type StudyRoom = {id:StudyId;name:string;hasSeats:boolean;width:number;height:number;capacity?:number};
export type StudyTeacher = {id:StudyId;name:string};
export type OwnStudy = {id:StudyId;period:number;status:string;room:{id:StudyId;name:string};seat?:{id:StudyId;name:string}|null;teacher?:StudyTeacher;reason?:string};
export type StudyStudent = {id:StudyId;name:string;grade:number;classNo:number;number:number};
export type StudyContext = {student:StudyStudent;date:string;open:boolean;opensAt:string;closesAt:string;periods:number[];entries:OwnStudy[];rooms:StudyRoom[];teachers:StudyTeacher[]};
export class StudyFailure extends Error {constructor(message:string,public status=400,public code?:string){super(message)}}
const validId=(id:unknown):id is StudyId=>typeof id==='string'?/^[A-Za-z0-9_-]{1,100}$/.test(id):typeof id==='number'&&Number.isSafeInteger(id)&&id>0;
type Send = (path:string,token:string,method?:string,body?:unknown)=>Promise<any>;
type Dependencies = {authorize:(request:Request)=>Promise<string|null>;send:Send;now?:()=>Date;limit:(key:string)=>boolean;getConnection?:(owner:string)=>Promise<string|null>;remember?:(owner:string,token:string,student:StudyStudent)=>Promise<void>;disconnect?:(owner:string)=>Promise<void>};
const positive=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0;
export const koreaDate=(now:Date)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function studyWindow(policy:any,now:Date){
 const date=koreaDate(now),day=new Date(date+'T12:00:00+09:00').getUTCDay();
 const rule=policy?.timelimit?.exception?.[date]??policy?.timelimit?.assign?.[day];
 const time=(t:any)=>{if(!t||!Number.isInteger(t.h)||!Number.isInteger(t.m)||t.h<0||t.h>24||t.m<0||t.m>59||(t.h===24&&t.m!==0))return null;return new Date(date+'T00:00:00+09:00').getTime()+(t.h*60+t.m)*60000};
 const start=time(rule?.start),end=time(rule?.end),key=policy?.timetable?.exception?.[date]??policy?.timetable?.assign?.[day],preset=policy?.timetable?.presets?.[key];
 const periods=Array.isArray(preset)?Array.from({length:preset.length},(_,i)=>i+1):[];
 return {date,open:start!==null&&end!==null&&start<=now.getTime()&&now.getTime()<end&&periods.length>0,opensAt:start===null?'':new Date(start).toISOString(),closesAt:end===null?'':new Date(end).toISOString(),periods};
}
export async function verifyStudyStudent(send:Send,token:string){
 let id:unknown;try{id=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).userId}catch{}
 if(!validId(id))throw new StudyFailure('EduSet 학생 계정을 연결해 주세요.',401);
 // The unsigned claim only chooses endpoints. EduSet verifies the actual token.
 const me=await send('/users/'+encodeURIComponent(String(id)),token);
 if(me?.id!==id||me?.role!=='STUDENT')throw new StudyFailure('본인의 EduSet 학생 계정으로 연결해 주세요.',403);
 const s=await send('/students/'+encodeURIComponent(String(id)),token);
 if(s?.id!==id)throw new StudyFailure('공식 학생 정보를 확인하지 못했습니다.',403);
 return {id:s.id,name:s.name,grade:s.grade,classNo:s.classNo,number:s.number} as StudyStudent;
}
async function ownEntries(send:Send,token:string,id:StudyId,date:string):Promise<OwnStudy[]>{
 const result=await send('/selfstudy/search',token,'POST',{studentId:id,date:date+'T00:00:00.000Z'});
 if(!Array.isArray(result))throw new StudyFailure('공식 신청 내역을 확인하지 못했습니다.',502);
 return result.filter(e=>e.type==='selfstudy'&&e.student?.id===id&&typeof e.date==='string'&&e.date.slice(0,10)===date&&validId(e.id)&&positive(e.period)&&validId(e.room?.id)).map(e=>({id:e.id,period:e.period,status:e.status,room:{id:e.room.id,name:e.room.name},seat:e.seat?{id:e.seat.id,name:e.seat.name}:null,teacher:e.teacher?{id:e.teacher.id,name:e.teacher.name}:undefined,reason:e.reason}));
}
const activeWrites=new Set<StudyId>();
const safeHosts=new Set(['cbgpu.com','www.cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com','app.cbgpu.com']);
export async function handleStudentStudy(request:Request,deps:Dependencies){
 let writeOwner:StudyId|undefined;let schoolOwner:string|undefined;
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
 try{
  const raw=request.headers.get('host')?.split(':')[0]||new URL(request.url).hostname,host=['127.0.0.1','localhost'].includes(raw)?request.headers.get('x-cbgpu-public-host')||raw:raw;
  if(!safeHosts.has(host))throw new StudyFailure('Not found',404);
  if(request.method==='POST'&&request.headers.get('origin')!=='https://'+host)throw new StudyFailure('올바른 사이트에서 다시 시도해 주세요.',403);
  const user=await deps.authorize(request);if(!user)throw new StudyFailure('승인된 CBGPU 계정으로 로그인해 주세요.',401);
  if(!deps.limit(user))throw new StudyFailure('요청이 많습니다. 잠시 후 다시 시도해 주세요.',429);
  const body:any=request.method==='POST'?await readJsonBody(request,8192):{};
  if(!body||typeof body!=='object'||Array.isArray(body))throw new StudyFailure('입력 내용을 확인해 주세요.');
  if(body.action==='disconnect'){
   if(deps.disconnect)await deps.disconnect(user);
   return reply({ok:true});
  }
  if(['inspect','remember'].includes(body.action)){
   const candidate=typeof body.accessToken==='string'?body.accessToken:'';
   if(!candidate||candidate.length>8192)throw new StudyFailure('공식 EduSet 로그인을 다시 진행해 주세요.',401);
   const identity=await verifyStudyStudent(deps.send,candidate);
   if(body.action==='remember'){
    if(!deps.remember)throw new StudyFailure('계정 연결 저장을 사용할 수 없습니다.',503);
    await deps.remember(user,candidate,identity);
   }
   return reply({student:identity,connected:body.action==='remember'});
  }
  const stored=deps.getConnection?await deps.getConnection(user):null;
  const token=stored||request.headers.get('x-eduset-token')?.replace(/^Bearer\s+/i,'')||'';

  if(!token||token.length>8192)throw new StudyFailure('EduSet 학생 계정을 연결해 주세요.',401,'school_connection_required');
  schoolOwner=user;
  const identity=await verifyStudyStudent(deps.send,token),now=deps.now?.()||new Date();
  if(request.method==='POST'&&['apply','cancel'].includes(body.action)){
   if(activeWrites.has(identity.id))throw new StudyFailure('이전 신청 작업을 처리 중입니다. 내 신청을 확인한 뒤 다시 시도해 주세요.',409);
   activeWrites.add(identity.id);writeOwner=identity.id;
  }
  const rawPolicy=await deps.send('/policies/selfstudy',token),policy=rawPolicy?.data??rawPolicy,window=studyWindow(policy,now);
  const entries=await ownEntries(deps.send,token,identity.id,window.date);
  if(request.method==='GET'){
   const [rooms,teachers]=await Promise.all([deps.send('/rooms',token),deps.send('/teachers',token)]);
   if(!Array.isArray(rooms)||!Array.isArray(teachers))throw new StudyFailure('교실·선생님 목록을 확인하지 못했습니다.',502);
   return reply({student:identity,...window,entries,rooms:rooms.map(r=>({id:r.id,name:r.name,hasSeats:r.hasSeats,width:r.width,height:r.height,capacity:r.capacity})),teachers:teachers.map(t=>({id:t.id,name:t.name}))});
  }
  if(!['apply','cancel'].includes(body.action))throw new StudyFailure('지원하지 않는 요청입니다.');
  if(body.date!==window.date)throw new StudyFailure('오늘 날짜의 신청만 처리할 수 있습니다. 새로고침해 주세요.');
  if(!window.open)throw new StudyFailure('현재는 공식 자습 신청 시간이 아닙니다.',409);
  if(body.action==='cancel'){
   if(!validId(body.id)||!entries.some(e=>e.id===body.id))throw new StudyFailure('본인의 신청 내역을 찾지 못했습니다.',404);
   if(!studyWindow(policy,deps.now?.()||new Date()).open)throw new StudyFailure('신청 시간이 종료됐습니다.',409);
   await deps.send('/selfstudy/'+body.id,token,'DELETE');
   const after=await ownEntries(deps.send,token,identity.id,window.date);
   if(after.some(e=>e.id===body.id))throw new StudyFailure('취소 결과를 확인하지 못했습니다. 내 신청을 새로고침해 주세요.',502);
   return reply({ok:true,entries:after});
  }
  if(!validId(body.roomId)||!validId(body.teacherId)||!positive(body.period)||!window.periods.includes(body.period)||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>1000)throw new StudyFailure('교실·선생님·교시·사유를 확인해 주세요.');
  // Never forward client-supplied studentId, status, attendance, overwrite or proxy options.
  if(entries.some(e=>e.period===body.period))throw new StudyFailure('이미 신청한 교시입니다. 변경하려면 기존 신청을 취소한 뒤 다시 신청해 주세요.',409);
  const [rooms,teachers]=await Promise.all([deps.send('/rooms',token),deps.send('/teachers',token)]);
  const room=Array.isArray(rooms)&&rooms.find(r=>String(r.id)===String(body.roomId));
  const teacher=Array.isArray(teachers)&&teachers.find(t=>String(t.id)===String(body.teacherId));
  if(!room||!teacher)throw new StudyFailure('교실 또는 선생님을 다시 선택해 주세요.');
  let seatId:StudyId|undefined;
  if(room.hasSeats){
   if(!validId(body.seatId))throw new StudyFailure('좌석을 선택해 주세요.');
   const composition=await deps.send('/rooms/'+room.id+'/composition',token);
   const seat=composition?.seats?.find((s:any)=>String(s.id)===String(body.seatId));
   if(!seat)throw new StudyFailure('선택한 교실의 좌석이 아닙니다.');
   seatId=seat.id;
  }else if(body.seatId!=null)throw new StudyFailure('이 교실은 좌석을 지정하지 않습니다.');
  if(!studyWindow(policy,deps.now?.()||new Date()).open)throw new StudyFailure('신청 시간이 종료됐습니다.',409);
  await deps.send('/selfstudy',token,'POST',{studentId:identity.id,date:window.date+'T00:00:00.000Z',roomId:room.id,teacherId:teacher.id,period:body.period,reason:body.reason.trim(),...(seatId===undefined?{}:{seatId})});
  const after=await ownEntries(deps.send,token,identity.id,window.date);
  if(!after.some(e=>e.period===body.period&&e.room.id===room.id&&(!room.hasSeats||e.seat?.id===seatId)))throw new StudyFailure('공식 등록 결과를 확인하지 못했습니다. 다시 신청하기 전에 내 신청을 새로고침해 주세요.',502);
  return reply({ok:true,entries:after});
 }catch(e){
  if(e instanceof StudyFailure){
   if(e.status===401&&schoolOwner&&deps.disconnect){await deps.disconnect(schoolOwner).catch(()=>{});return reply({message:'EduSet 연결이 만료됐습니다. 다시 로그인해 주세요.',code:'school_connection_required'},401)}
   return reply({message:e.message,...(e.code?{code:e.code}:{})},e.status);
  }
  const status=(e as {status?:number})?.status;if(status===413||status===400)return reply({message:'입력 내용을 확인해 주세요.'},status);
  return reply({message:'학교 서비스 응답을 확인하지 못했습니다. 다시 신청하기 전에 내 신청 내역을 새로고침해 주세요.'},503);
 }finally{if(writeOwner!==undefined)activeWrites.delete(writeOwner)}
}
