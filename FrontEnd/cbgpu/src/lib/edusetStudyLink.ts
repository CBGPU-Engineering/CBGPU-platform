import {randomBytes} from 'node:crypto';
import {readJsonBody} from './requestSecurity';
import {StudyFailure,type StudyStudent,type StudyId} from './edusetStudent';
type LinkEntry={owner:string;expires:number;attempts:number;student?:StudyStudent;token?:string};
/** Five-minute, one-use handoffs. Personal school tokens never go into URLs or disk. */
export function createStudyLinkHandler(deps:{authorize:(request:Request)=>Promise<string|null>;verify:(token:string)=>Promise<StudyStudent>;limit:(key:string)=>boolean;now?:()=>number}){
 const entries=new Map<string,LinkEntry>();
 const now=()=>deps.now?.()??Date.now();
 const cleanup=setInterval(()=>{for(const [id,e]of entries)if(e.expires<=now())entries.delete(id)},60000);cleanup.unref();
 const normalize=(value:unknown)=>typeof value==='string'?value.replace(/[\s-]/g,'').toUpperCase():'';
 return async(request:Request)=>{
  const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
  try{
   const host=request.headers.get('host')?.split(':')[0]||new URL(request.url).hostname;
   if(!['cbgpu.com','www.cbgpu.com','app.cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com'].includes(host)||request.headers.get('origin')!=='https://'+host)throw new StudyFailure('올바른 사이트에서 연결해 주세요.',403);
   const body:any=await readJsonBody(request,12000);if(!body||typeof body!=='object')throw new StudyFailure('입력을 확인해 주세요.');
   for(const [id,e]of entries)if(e.expires<=now())entries.delete(id);
   const id=normalize(body.id);
   if(body.action==='receive'){
    const ip=request.headers.get('cf-connecting-ip')||'local';if(!deps.limit('receive:'+ip))throw new StudyFailure('잠시 후 다시 연결해 주세요.',429);
    if(!/^[A-F0-9]{16}$/.test(id))throw new StudyFailure('연결 코드를 확인해 주세요.');
    const entry=entries.get(id);if(!entry)throw new StudyFailure('연결 코드가 만료됐거나 올바르지 않습니다.',404);
    if(entry.token)throw new StudyFailure('이미 전달된 연결입니다. CBGPU에서 학생 정보를 확인해 주세요.',409);
    if(++entry.attempts>5){entries.delete(id);throw new StudyFailure('새 연결 코드를 만들어 주세요.',429)}
    const token=typeof body.accessToken==='string'?body.accessToken:'';
    if(!token||token.length>8192)throw new StudyFailure('공식 사이트에 다시 로그인해 주세요.',401);
    const student=await deps.verify(token);
    // Check expiry and identity again after external verification.
    if(entries.get(id)!==entry||entry.expires<=now())throw new StudyFailure('연결 코드가 만료됐습니다.',410);
    if(entry.token)throw new StudyFailure('이미 전달된 연결입니다.',409);
    entry.student=student;entry.token=token;
    return reply({ok:true});
   }
   const owner=await deps.authorize(request);if(!owner)throw new StudyFailure('CBGPU에 로그인해 주세요.',401);
   if(!deps.limit('owner:'+owner))throw new StudyFailure('잠시 후 다시 시도해 주세요.',429);
   if(body.action==='start'){
    if(entries.size>=1000)throw new StudyFailure('잠시 후 다시 연결해 주세요.',503);
    for(const [key,e]of entries)if(e.owner===owner)entries.delete(key);
    const id=randomBytes(8).toString('hex').toUpperCase(),expires=now()+5*60_000;entries.set(id,{owner,expires,attempts:0});return reply({id,expires});
   }
   const entry=entries.get(id);if(!entry||entry.owner!==owner)throw new StudyFailure('연결 코드가 만료됐거나 올바르지 않습니다.',404);
   if(body.action==='poll')return reply({ready:!!entry.token,student:entry.student??null,expires:entry.expires});
   if(body.action==='cancel'){entries.delete(id);return reply({ok:true})}
   if(body.action==='claim'){
    if(!entry.token||!entry.student)throw new StudyFailure('공식 사이트에서 계정을 먼저 연결해 주세요.',409);
    if(String(body.studentId as StudyId)!==String(entry.student.id))throw new StudyFailure('표시된 학생 정보를 다시 확인해 주세요.',409);
    const student=await deps.verify(entry.token);
    if(entries.get(id)!==entry||entry.expires<=now())throw new StudyFailure('연결 코드가 만료됐습니다.',410);
    entries.delete(id);return reply({accessToken:entry.token,student});
   }
   throw new StudyFailure('지원하지 않는 요청입니다.');
  }catch(e){if(e instanceof StudyFailure)return reply({message:e.message},e.status);const status=(e as {status?:number})?.status;return reply({message:'연결 결과를 확인하지 못했습니다. 다시 시도해 주세요.'},status===413?413:503)}
 };
}
