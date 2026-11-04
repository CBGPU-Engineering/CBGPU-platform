'use client';
import DemoSchoolAccountLink from './DemoSchoolAccountLink';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {supabase} from '@/lib/supabase';
import {getNativeBridge,onNativeBridgeReady,type NativeBridge} from '@/lib/nativeBridge';
import type {StudyStudent} from '@/lib/edusetStudent';
/** User-run bookmarklet only reads the user's current official EduSet session. */
export const SCHOOL_LINK_BOOKMARK='javascript:'+encodeURIComponent(`(()=>{if(location.origin!=='https://cbsh.edu-set.com'){alert('공식 EduSet에서 로그인한 뒤 실행해 주세요.');return}const token=localStorage.getItem('accessToken');if(!token){alert('공식 EduSet에 먼저 로그인해 주세요.');return}const popup=window.open('https://app.cbgpu.com/study/link','_blank');if(!popup){alert('팝업을 허용하고 다시 실행해 주세요.');return}const receive=e=>{if(e.origin==='https://app.cbgpu.com'&&e.source===popup&&e.data?.type==='cbgpu:school-link-ready'){popup.postMessage({type:'cbgpu:school-session',token},'https://app.cbgpu.com');window.removeEventListener('message',receive)}};window.addEventListener('message',receive);setTimeout(()=>window.removeEventListener('message',receive),60000)})()`);
function LegacySchoolAccountLink({onConnected}:{onConnected:(token:string)=>Promise<void>}){
 const [id,setId]=useState(''),[expires,setExpires]=useState(0),[student,setStudent]=useState<StudyStudent|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState('');const bookmark=useRef<HTMLAnchorElement>(null),idRef=useRef(''),alive=useRef(true);
 useEffect(()=>{if(bookmark.current)bookmark.current.href=SCHOOL_LINK_BOOKMARK},[]);
 async function api(body:unknown){const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('CBGPU에 로그인해 주세요.');const r=await fetch('/api/study/link',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(body),cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.message||'연결하지 못했습니다.');return data}
 useEffect(()=>{alive.current=true;let cancelled=false;void api({action:'start'}).then(data=>{if(cancelled){void api({action:'cancel',id:data.id}).catch(()=>{});return}idRef.current=data.id;setId(data.id);setExpires(data.expires)}).catch(e=>{if(!cancelled)setError(e.message)});return()=>{alive.current=false;cancelled=true;if(idRef.current)void api({action:'cancel',id:idRef.current}).catch(()=>{})}},[]);
 useEffect(()=>{if(!id||busy)return;let cancelled=false;const poll=async()=>{if(Date.now()>=expires){setError('연결 코드가 만료됐어요. 창을 닫고 다시 연결해 주세요.');return}try{const data=await api({action:'poll',id});if(!cancelled&&data.ready)setStudent(data.student)}catch(e){if(!cancelled)setError((e as Error).message)}};const timer=setInterval(()=>void poll(),3000);return()=>{cancelled=true;clearInterval(timer)}},[id,expires,busy]);
 async function copy(value:string,label:string){try{await navigator.clipboard.writeText(value);setCopied(label)}catch{setError('복사하지 못했습니다. 표시된 코드를 직접 선택해 복사하세요.')}}
 async function claim(){if(!student||busy)return;setBusy(true);setError('');try{const result=await api({action:'claim',id,studentId:student.id});idRef.current='';if(!alive.current)return;await onConnected(result.accessToken)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div className="space-y-4"><p className="text-sm text-muted-foreground">학교 보안 확인은 공식 EduSet에서 진행합니다. 최초 연결에 PC 브라우저를 이용하면 편해요.</p>{student?<div className="space-y-3 rounded-xl border p-4"><p className="font-semibold">{student.grade}학년 {student.classNo}반 {student.number}번 {student.name}</p><p className="text-sm">본인 계정이 맞는지 확인해 주세요.</p><Button className="w-full min-h-11" disabled={busy} onClick={()=>void claim()}>{busy?'연결 중…':'이 학생 계정 연결'}</Button></div>:<><div className="rounded-xl border p-3 space-y-2"><p className="text-xs text-muted-foreground">연결 코드 · 5분 동안 유효</p><p className="select-all break-all font-mono text-xl tracking-wider" aria-label="EduSet 연결 코드">{id?id.match(/.{1,4}/g)?.join('-'):'코드 준비 중…'}</p><Button variant="outline" size="sm" disabled={!id} onClick={()=>void copy(id,'연결 코드 복사됨')}>코드 복사</Button></div><ol className="list-decimal pl-5 space-y-3 text-sm"><li><a href="https://cbsh.edu-set.com/signin" target="_blank" rel="noopener noreferrer" className="underline">공식 EduSet</a>에 본인 학생 계정으로 로그인하세요.</li><li>아래 연결 도우미를 즐겨찾기 바로 끌어 놓거나, 즐겨찾기 파일을 받아 브라우저의 즐겨찾기 가져오기를 사용하세요. 한 번만 설치하면 됩니다. 모바일은 도우미 주소를 복사한 뒤 즐겨찾기의 주소로 저장하세요.<div className="mt-2 flex flex-wrap gap-2"><a ref={bookmark} draggable className="inline-flex min-h-11 cursor-grab items-center rounded-lg border px-3 font-medium" onClick={e=>{e.preventDefault();setCopied('공식 EduSet 페이지에서 이 즐겨찾기를 실행해 주세요.')}}>CBGPU 계정 연결</a><a href="/downloads/cbgpu-eduset-student-bookmark.html" download className="inline-flex min-h-11 items-center rounded-lg border px-3">즐겨찾기 파일 받기</a><Button variant="outline" size="sm" onClick={()=>void copy(SCHOOL_LINK_BOOKMARK,'도우미 주소 복사됨')}>도우미 주소 복사</Button></div></li><li>공식 EduSet 페이지에서 저장한 즐겨찾기를 실행하고, 새 창에 위 연결 코드를 입력하세요.</li><li>이 화면으로 돌아와 표시된 본인 학생 정보를 확인하면 완료돼요.</li></ol></>}{copied&&<p role="status" className="text-sm text-muted-foreground">{copied}</p>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}

export default function SchoolAccountLink({onConnected}:{onConnected:(token:string)=>Promise<void>}){
 const [bridge,setBridge]=useState<NativeBridge|undefined>(()=>getNativeBridge()),[busy,setBusy]=useState(false),[error,setError]=useState(''),[candidate,setCandidate]=useState<{token:string;student:StudyStudent}|null>(null);
 const started=useRef(false);
 useEffect(()=>{if(bridge?.loginEduset&&!started.current){started.current=true;void login()}},[bridge]);
 useEffect(()=>onNativeBridgeReady(setBridge),[]);
 async function login(forceSignOut=false){
  if(!bridge?.loginEduset||busy)return;
  setBusy(true);setError('');setCandidate(null);
  try{
   const result=await bridge.loginEduset({forceSignOut});if(result.cancelled||!result.accessToken)return;
   const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('CBGPU에 다시 로그인해 주세요.');
   const response=await fetch('/api/study/student',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'inspect',accessToken:result.accessToken})});
   const data=await response.json();if(!response.ok)throw Error(data.message||'학생 계정을 확인하지 못했습니다.');
   setCandidate({token:result.accessToken,student:data.student});
  }catch(e){const value=e as {message?:string;error?:string};setError(value.message||value.error||'학교 로그인을 완료하지 못했습니다. 다시 시도해 주세요.')}finally{setBusy(false)}
 }
 async function confirmAccount(){if(!candidate||busy)return;setBusy(true);setError('');try{await onConnected(candidate.token);setCandidate(null)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 if(process.env.NEXT_PUBLIC_CBGPU_DEMO==='1')return <DemoSchoolAccountLink onConnected={onConnected}/>;
 return <div className="space-y-4">
  {bridge?.loginEduset?<>
   {candidate?<div className="space-y-3 rounded-xl border p-4"><p className="font-semibold">{candidate.student.grade}학년 {candidate.student.classNo}반 {candidate.student.number}번 {candidate.student.name}</p><p className="text-sm text-muted-foreground">본인 계정이 맞으면 연결하세요. 다음부터는 CBGPU에서 바로 신청할 수 있어요.</p><Button className="w-full min-h-11" disabled={busy} onClick={()=>void confirmAccount()}>{busy?'연결 저장 중…':'이 계정으로 연결'}</Button><Button variant="ghost" className="w-full" disabled={busy} onClick={()=>void login(true)}>다른 EduSet 계정으로 로그인</Button></div>:<><p className="text-sm text-muted-foreground">공식 EduSet 로그인 창이 열려요. 로그인 후 CBGPU로 자동 돌아옵니다.</p><Button className="w-full min-h-12" disabled={busy} onClick={()=>void login()}>{busy?'학교 로그인 진행 중…':'EduSet 로그인'}</Button></>}
  </>:<div className="space-y-3"><p className="text-sm text-muted-foreground">로그인 한 번으로 연결하는 기능은 앱 v1.0.7부터 지원해요. 한 번 연결하면 같은 CBGPU 계정의 앱·웹에서 계속 사용할 수 있어요.</p><a href="/downloads/cbgpu-1.0.7.apk" className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">간편 로그인 앱으로 업데이트</a><details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-medium">앱 업데이트 없이 최초 연결하기</summary><div className="mt-4"><LegacySchoolAccountLink onConnected={onConnected}/></div></details></div>}
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  <p className="text-xs text-muted-foreground">비밀번호는 공식 학교 로그인 창에서만 입력합니다. 학교 세션이 만료되면 다시 로그인하세요.</p>
 </div>;
}
