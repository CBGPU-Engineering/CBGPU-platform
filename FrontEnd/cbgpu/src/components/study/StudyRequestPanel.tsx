'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Plus,RefreshCw,Unplug,X} from 'lucide-react';
import {useAuth} from '@/lib/useAuth';
import {supabase} from '@/lib/supabase';
import {getRoomComposition,getSeatOccupations,type Seat} from '@/lib/eduset';
import type {StudyContext,OwnStudy,StudyId} from '@/lib/edusetStudent';
import {Button} from '@/components/ui/button';
import SchoolAccountLink from './SchoolAccountLink';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogClose} from '@/components/ui/dialog';
export type StudyPrefill={roomId:StudyId;seatId:StudyId;period:number};
const field='w-full min-w-0 min-h-11 rounded-lg border bg-background px-3 py-2 text-base';
const statusLabel:Record<string,string>={PENDING:'승인 대기',APPROVED:'승인됨',REJECTED:'거절됨'};
export default function StudyRequestPanel({prefill,onPrefillConsumed,onChanged}:{prefill:StudyPrefill|null;onPrefillConsumed:()=>void;onChanged:()=>void}){
 const {user,isLoading}=useAuth();const [token,setToken]=useState(''),[context,setContext]=useState<StudyContext|null>(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[dialog,setDialog]=useState<'connect'|'apply'|null>(null);
 const [roomId,setRoomId]=useState(''),[period,setPeriod]=useState('1'),[seatId,setSeatId]=useState(''),[teacherId,setTeacherId]=useState(''),[reason,setReason]=useState('');
 const [seats,setSeats]=useState<Seat[]>([]),[occupied,setOccupied]=useState<StudyId[]>([]),[seatLoading,setSeatLoading]=useState(false),[seatError,setSeatError]=useState('');
 const owner=useRef(user?.id);owner.current=user?.id;const refreshId=useRef(0);
 const request=useCallback(async(schoolToken:string,body?:unknown)=>{
  const expected=owner.current;const {data:{session}}=await supabase.auth.getSession();if(!session||session.user.id!==expected)throw Error('CBGPU 로그인이 필요합니다.');
  const response=await fetch('/api/study/student',{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  const data=await response.json().catch(()=>null);if(!response.ok)throw Object.assign(Error(data?.message||'공식 신청 결과를 확인하지 못했습니다. 내 신청을 새로고침해 주세요.'),{code:data?.code});return data;
 },[]);
 const refresh=useCallback(async(schoolToken:string)=>{const id=++refreshId.current,expected=owner.current;setLoading(true);try{const data=await request(schoolToken);if(id===refreshId.current&&expected===owner.current){setContext(data);setError('')}return expected===owner.current?data as StudyContext:null}catch(e){if(id===refreshId.current&&expected===owner.current){if((e as {code?:string}).code==='school_connection_required'){setContext(null);setToken('');setError('')}else setError((e as Error).message);}return null}finally{if(id===refreshId.current&&expected===owner.current)setLoading(false)}},[request]);
 useEffect(()=>{++refreshId.current;setContext(null);setToken('');setError('');setDialog(null);setRoomId('');setSeatId('');setTeacherId('');setReason('');setPeriod('1');setNotice('');if(!user)return;
  let cancelled=false;const id=user.id;
  void(async()=>{try{const legacy=sessionStorage.getItem('cbgpu-eduset-student:'+id);if(legacy){await request('',{action:'remember',accessToken:legacy});sessionStorage.removeItem('cbgpu-eduset-student:'+id)}}catch{}if(cancelled)return;const data=await refresh('');if(data&&!cancelled)setToken('connected')})();
  return()=>{cancelled=true};
 },[user?.id,refresh,request]);
 useEffect(()=>{if(!token)return;const timer=setInterval(()=>void refresh(token),60000);return()=>clearInterval(timer)},[token,refresh]);
 useEffect(()=>{if(!prefill)return;setRoomId(String(prefill.roomId));setSeatId(String(prefill.seatId));setPeriod(String(prefill.period));setDialog(token&&context?'apply':'connect');onPrefillConsumed()},[prefill,token,context,onPrefillConsumed]);
 const room=context?.rooms.find(r=>String(r.id)===roomId);
 useEffect(()=>{let cancelled=false;setSeats([]);setOccupied([]);setSeatError('');if(!room?.hasSeats){setSeatLoading(false);return}setSeatLoading(true);
  void Promise.all([getRoomComposition(room.id),getSeatOccupations(room.id,context!.date)]).then(([composition,reservations])=>{if(cancelled)return;setSeats(composition.seats);setOccupied(reservations.filter(r=>r.period===Number(period)&&r.studentId!==context!.student.id).map(r=>r.seatId))}).catch(()=>{if(!cancelled)setSeatError('좌석 현황을 확인하지 못했습니다. 잠시 후 교실을 다시 선택해 주세요.')}).finally(()=>{if(!cancelled)setSeatLoading(false)});return()=>{cancelled=true};
 },[room?.id,room?.hasSeats,period,context?.date,context?.student.id]);
 async function disconnect(){if(busy)return;setBusy(true);setError('');try{await request('',{action:'disconnect'});if(user)sessionStorage.removeItem('cbgpu-eduset-student:'+user.id);++refreshId.current;setToken('');setContext(null);setNotice('EduSet 연결을 해제했어요.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function connected(schoolToken:string){
  if(!user||owner.current!==user.id)throw Error('CBGPU에 다시 로그인해 주세요.');
  await request('',{action:'remember',accessToken:schoolToken});
  const data=await refresh('');
  if(data){setToken('connected');setNotice('학교 계정을 저장했어요. 다음부터는 바로 신청할 수 있어요.');setDialog(roomId?'apply':null)}
 }
 async function apply(e:React.FormEvent){e.preventDefault();if(!context||busy)return;const expected=owner.current;setBusy(true);setError('');setNotice('');
  try{await request(token,{action:'apply',date:context.date,roomId,teacherId,period:Number(period),...(room?.hasSeats?{seatId}:{}),reason});if(expected!==owner.current)return;setDialog(null);setNotice('공식 EduSet 명단에 신청이 반영됐어요.');await refresh(token);onChanged()}catch(e){if(expected!==owner.current)return;setError((e as Error).message);await refresh(token);setError((e as Error).message);onChanged()}finally{setBusy(false)}
 }
 async function cancel(entry:OwnStudy){if(!context||busy||!confirm(`${entry.period}교시 ${entry.room.name} 신청을 취소할까요? 변경하려면 취소 후 다시 신청해야 합니다.`))return;const expected=owner.current;setBusy(true);setError('');setNotice('');
  try{await request(token,{action:'cancel',date:context.date,id:entry.id});if(expected!==owner.current)return;setNotice('공식 EduSet 신청을 취소했어요.');await refresh(token);onChanged()}catch(e){if(expected!==owner.current)return;await refresh(token);setError((e as Error).message);onChanged()}finally{setBusy(false)}
 }
 useEffect(()=>{
  if(!context)return;
  const available=context.periods.filter(p=>!context.entries.some(e=>e.period===p));
  if(!available.includes(Number(period)))setPeriod(available.length?String(available[0]):'');
 },[context,period]);
 const periodTaken=context?.entries.some(e=>e.period===Number(period));
 const windowTime=(value:string)=>value?new Date(value).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}):'확인 필요';
 if(isLoading)return null;
 return <section aria-label="내 자습 신청" className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5 space-y-4">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-lg">내 자습 신청</h2><p className="mt-1 text-sm text-muted-foreground">공식 EduSet 명단에 직접 반영됩니다. 신청·취소는 공식 접수 시간에 가능해요.</p></div>{user?<Button className="min-h-11" disabled={loading||busy||!!context&&!context.open} onClick={()=>{setError('');setDialog(context?'apply':'connect')}}><Plus className="size-4"/>{context?'자습 신청하기':'EduSet 로그인'}</Button>:<Button asChild><Link href="/auth/login?next=%2Fstudy">로그인하고 신청하기</Link></Button>}</div>
  {notice&&<p role="status" className="text-sm text-primary">{notice}</p>}{error&&dialog===null&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {token&&!context&&<Button variant="outline" disabled={loading} onClick={()=>void refresh(token)}>{loading?'연결 확인 중…':'연결 다시 확인'}</Button>}
  {context&&<><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{context.student.grade}{context.student.classNo}{String(context.student.number).padStart(2,'0')} {context.student.name} · {context.date}</span><div className="flex gap-2"><Button size="sm" variant="ghost" aria-label="내 신청 새로고침" disabled={loading||busy} onClick={()=>void refresh(token)}><RefreshCw className="size-4"/></Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>void disconnect()}><Unplug className="size-4"/>연결 해제</Button></div></div>
   <p className="text-sm text-muted-foreground">{context.open?'현재 신청 가능':'현재 접수 시간 아님'} · {windowTime(context.opensAt)}–{windowTime(context.closesAt)} (한국 시간)</p>
   {context.entries.length?<ul className="divide-y rounded-xl border">{context.entries.map(entry=><li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="font-medium">{entry.period}교시 · {entry.room.name}{entry.seat?` · ${entry.seat.name}번`:''}</p><p className="text-xs text-muted-foreground">{statusLabel[entry.status]||entry.status}{entry.teacher?' · '+entry.teacher.name+' 선생님':''}</p></div><Button variant="outline" size="sm" disabled={!context.open||busy||loading} onClick={()=>void cancel(entry)}>취소</Button></li>)}</ul>:<p className="text-sm text-muted-foreground">오늘 신청한 자습이 없어요.</p>}
   <p className="text-xs text-muted-foreground">교실·좌석을 변경하려면 기존 신청을 취소한 뒤 다시 신청하세요. 승인 여부는 공식 EduSet의 처리 결과를 따릅니다.</p>
  </>}
  <Dialog open={dialog!==null} onOpenChange={open=>{if(!open&&!busy){setDialog(null);setError('')}}}>
   <DialogContent data-study-request-dialog style={{overflow:'hidden'}} showCloseButton={false} className="flex min-h-0 min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" aria-describedby="study-request-description">
    <DialogHeader className="shrink-0 flex-row items-start gap-3 border-b p-4"><div className="min-w-0 flex-1 space-y-2"><DialogTitle>{dialog==='connect'?'EduSet 학생 계정 연결':'자습 신청'}</DialogTitle><DialogDescription id="study-request-description">{dialog==='connect'?'학교 계정은 한 번만 연결하면 됩니다. 비밀번호는 공식 EduSet 로그인 창에서 입력합니다.':'교실과 담당 선생님, 교시를 선택해 주세요.'}</DialogDescription></div><DialogClose asChild><Button variant="ghost" size="icon" disabled={busy} aria-label="신청 창 닫기" className="size-11 shrink-0"><X/></Button></DialogClose></DialogHeader>
    <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
     {error&&<p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
     {dialog==='connect'?<SchoolAccountLink onConnected={connected}/>:context&&<form onSubmit={apply} className="space-y-4">
      <label className="block text-sm font-medium">교실<select required className={field+' mt-2'} value={roomId} onChange={e=>{setRoomId(e.target.value);setSeatId('')}} disabled={busy}><option value="">교실 선택</option>{context.rooms.map(r=><option key={r.id} value={r.id}>{r.name}{r.hasSeats?' · 좌석제':' · 정원제'}</option>)}</select></label>
      <label className="block text-sm font-medium">교시<select required className={field+' mt-2'} value={period} onChange={e=>{setPeriod(e.target.value);setSeatId('')}} disabled={busy}>{context.periods.map(p=><option key={p} value={p} disabled={context.entries.some(e=>e.period===p)}>{p}교시{context.entries.some(e=>e.period===p)?' · 이미 신청함':''}</option>)}</select></label>
      {room?.hasSeats&&<label className="block text-sm font-medium">좌석<select required className={field+' mt-2'} value={seatId} onChange={e=>setSeatId(e.target.value)} disabled={busy||seatLoading||!!seatError}><option value="">{seatLoading?'좌석 확인 중…':'좌석 선택'}</option>{seats.map(s=><option key={s.id} value={s.id} disabled={occupied.includes(s.id)}>{s.name}번{occupied.includes(s.id)?' · 신청됨':''}</option>)}</select>{seatError&&<span role="alert" className="text-xs text-destructive">{seatError}</span>}</label>}
      <label className="block text-sm font-medium">담당 선생님<select required className={field+' mt-2'} value={teacherId} onChange={e=>setTeacherId(e.target.value)} disabled={busy}><option value="">선생님 선택</option>{context.teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className="block text-sm font-medium">신청 사유<textarea required maxLength={1000} className={field+' mt-2 min-h-20'} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy} placeholder="예: 자율학습, 연구 활동"/></label>
      <Button type="submit" className="w-full min-h-11" disabled={busy||loading||!context.open||!context.periods.includes(Number(period))||periodTaken||!room||room.hasSeats&&(seatLoading||!!seatError||!seatId||occupied.some(id=>String(id)===seatId))}>{busy?'공식 명단에 반영 중…':'공식 EduSet에 신청'}</Button>
     </form>}
    </div>
   </DialogContent>
  </Dialog>
 </section>;
}
