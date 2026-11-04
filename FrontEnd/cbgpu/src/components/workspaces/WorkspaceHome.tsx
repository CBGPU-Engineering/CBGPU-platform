'use client';
import {useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import Link from 'next/link';
import {ArrowRight,Plus,Star,Clock,CheckCircle2,History,BookOpen,FileText,Smartphone} from 'lucide-react';
import {useAuth} from '@/lib/useAuth';
import {supabase} from '@/lib/supabase';
import {workspaces,workspaceServicePaths} from '@/lib/workspaces';
import {serviceGroups} from '@/lib/serviceNavigation';
import {useWorkspace,useIsAppWorkspace} from './WorkspaceShell';
import {useHomeGreeting} from '@/lib/useHomeGreeting';
import {useRecentServices} from '@/lib/useRecentServices';
import {serviceDestination} from '@/lib/serviceDiscovery';
import FrontendActivity from '@/components/deploy/FrontendActivity';
import AccountEntry from './AccountEntry';
import {serverProjectRequest,deploymentApi} from '@/lib/deploymentApi';
import DailyBriefing from '@/components/DailyBriefing';
import ServiceDirectory from '@/components/services/ServiceDirectory';
import './discovery-home.css';
type Reservation={id:string;gpu_id:number;start_time:string;end_time:string;status:string};
type Project={id:string;name:string;phase:string};
const services=serviceGroups.flatMap(g=>g.services);
function subscribeFavorites(callback:()=>void){window.addEventListener('storage',callback);window.addEventListener('cbgpu:favorites',callback);return()=>{window.removeEventListener('storage',callback);window.removeEventListener('cbgpu:favorites',callback)}}
function savedList(key:string):string[]{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.filter((item:unknown):item is string=>typeof item==='string').map(item=>item==='/manufacturing'?'/manufacturing/print':item):[]}catch{return[]}}
export default function WorkspaceHome(){
 const greeting=useHomeGreeting(),isApp=useIsAppWorkspace(),mode=useWorkspace(),workspace=workspaces[mode],{user,profile}=useAuth(),owner=user?.id||'guest';
 const [editing,setEditing]=useState(false),[notice,setNotice]=useState('');
 const [work,setWork]=useState<{owner:string;reservations:Reservation[]|null;projects:Project[]|null;gpuError:boolean;serverError:boolean}|null>(null);
 const recent=useRecentServices(owner,mode),key=`cbgpu-favorites:${owner}:${mode}`;
 const saved=useSyncExternalStore(subscribeFavorites,()=>{try{return localStorage.getItem(key)}catch{return null}},()=>null);
 const favorites=useMemo(()=>{try{const value=JSON.parse(saved||'null');if(Array.isArray(value))return [...new Set(value.filter((v:unknown):v is string=>typeof v==='string').map(v=>v==='/manufacturing'?'/manufacturing/print':v))].filter(href=>workspaceServicePaths[mode].includes(href)).slice(0,8)}catch{}return workspace.primary.slice(0,4)},[saved,workspace.primary,mode]);
 // Preserve personal shortcuts and recents from both old spaces on each origin.
 useEffect(()=>{if(mode!=='researcher')return;try{const marker=`cbgpu-merged-space:${owner}:v1`;if(localStorage.getItem(marker))return;for(const prefix of ['cbgpu-favorites','cbgpu-recent']){const current=`${prefix}:${owner}:researcher`,legacy=`${prefix}:${owner}:developer`;if(localStorage.getItem(legacy)!==null){const merged=[...new Set([...savedList(current),...savedList(legacy)])].filter(href=>workspaceServicePaths.researcher.includes(href)).slice(0,prefix==='cbgpu-favorites'?8:5);localStorage.setItem(current,JSON.stringify(merged));}}localStorage.setItem(marker,'1');window.dispatchEvent(new Event('cbgpu:favorites'));window.dispatchEvent(new Event('cbgpu:recent'))}catch{}},[mode,owner]);
 useEffect(()=>{if(!user||mode==='student')return;let live=true;const id=user.id;setWork({owner:id,reservations:null,projects:null,gpuError:false,serverError:false});
  const load=async()=>{await Promise.allSettled([
   (async()=>{try{const result=await supabase.from('reservations').select('id,gpu_id,start_time,end_time,status').eq('user_id',id).in('status',['pending','approved']).gt('end_time',new Date().toISOString()).order('start_time').limit(3);if(result.error)throw result.error;if(live)setWork(value=>value?.owner===id?{...value,reservations:result.data||[],gpuError:false}:value)}catch{if(live)setWork(value=>value?.owner===id?{...value,reservations:[],gpuError:true}:value)}})(),
   (async()=>{try{const response=await serverProjectRequest();if(response.error)throw Error(response.error.message);const projects:Project[]=await Promise.all((response.data||[]).slice(0,3).map(async(p:{id:string;name:string;status:string;env_vars?:Record<string,string>;deployed_at?:string;deploy_requested_at?:string})=>{let phase=p.status==='approved'?(p.deployed_at&&(!p.deploy_requested_at||p.deployed_at>=p.deploy_requested_at)?'ready':'queued'):p.status;if(p.env_vars?.CBGPU_DEPLOY_ENGINE==='compose'){try{phase=(await deploymentApi('compose/'+p.id)).status}catch{phase='unknown'}}return{id:p.id,name:p.name,phase}}));if(live)setWork(value=>value?.owner===id?{...value,projects,serverError:false}:value)}catch{if(live)setWork(value=>value?.owner===id?{...value,projects:[],serverError:true}:value)}})(),
  ])};void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load()},30000);return()=>{live=false;clearInterval(timer)};
 },[user?.id,mode]);
 const selected=favorites.flatMap(href=>{const service=services.find(s=>s.href===href);return service?[service]:[]}),ownWork=work?.owner===user?.id?work:null;
 const href=(value:string)=>serviceDestination(value,mode,isApp);
 const toggle=(value:string)=>{const next=favorites.includes(value)?favorites.filter(item=>item!==value):favorites.length<8?[...favorites,value]:favorites;try{localStorage.setItem(key,JSON.stringify(next));window.dispatchEvent(new Event('cbgpu:favorites'));setNotice('즐겨찾기를 저장했어요.')}catch{setNotice('저장 공간을 확인하고 다시 시도해 주세요.')}};
 return <div className="cb-overview cb-refreshed-home cb-audience-design cb-discovery-home">
  <section className="cb-home-hero"><div className="cb-discovery-greeting"><div><p className="cb-home-greeting">{workspace.label}</p><h1>{profile?.full_name?`${profile.full_name}님, ${greeting}`:greeting}</h1><p>{mode==='student'?'오늘 필요한 학교생활, 여기서 바로 시작하세요.':'실험하고, 만들고, 배포하는 일을 한곳에서.'}</p></div>{!isApp&&<AccountEntry/>}</div>{!isApp&&<Link href="/download" data-app-download-link className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold"><Smartphone size={18}/>Android 앱 다운로드<ArrowRight size={15}/></Link>}</section>
  <ServiceDirectory key={mode} audience={mode} isApp={isApp} home/>
  <section className="cb-home-pins" aria-label="즐겨찾기"><div className="cb-section-heading"><h2><Star size={17}/>즐겨찾기</h2><button onClick={()=>setEditing(value=>!value)} aria-label="즐겨찾기 편집" aria-expanded={editing}>{editing?'편집 완료':'편집'}</button></div><p className="cb-favorites-feedback" role="status" aria-live="polite">{notice}</p>{editing&&<div className="cb-favorites-editor"><p>자주 쓰는 기능을 최대 8개 선택하세요. <strong>{selected.length}/8</strong></p><div>{services.filter(service=>workspaceServicePaths[mode].includes(service.href)).map(service=><button key={service.href} onClick={()=>toggle(service.href)} aria-pressed={favorites.includes(service.href)} disabled={!favorites.includes(service.href)&&favorites.length>=8}><Star size={14} fill={favorites.includes(service.href)?'currentColor':'none'}/>{service.label}</button>)}</div></div>}<div className="cb-pinned-links">{selected.map(service=><Link key={service.href} href={href(service.href)}><service.icon size={17}/>{service.label}<ArrowRight size={13}/></Link>)}{!selected.length&&<button onClick={()=>setEditing(true)}><Plus size={17}/>즐겨찾기 추가</button>}</div></section>
  {recent.length>0&&<section className="cb-home-recents" aria-label="최근 사용한 기능"><div className="cb-section-heading"><h2><History size={17}/>최근 사용</h2></div><div>{recent.filter(service=>workspaceServicePaths[mode].includes(service.href)).map(service=><Link key={service.href} href={href(service.href)}><service.icon size={17}/><span>{service.label}</span><ArrowRight size={14}/></Link>)}</div></section>}
  {mode==='student'?<section className="cb-student-briefing"><DailyBriefing/></section>:<>
   <div className="cb-work-grid"><section className="cb-work-panel"><div className="cb-section-heading"><h2>내 GPU 예약</h2><Link href={href('/dashboard')}>예약 보기<ArrowRight size={14}/></Link></div>{!user?<p className="cb-empty">로그인하면 내 예약을 확인할 수 있어요.</p>:ownWork?.gpuError?<p role="alert" className="cb-empty">예약을 불러오지 못했어요. 예약 보기에서 다시 확인해 주세요.</p>:!ownWork?.reservations?<p role="status" className="cb-empty">예약을 불러오는 중…</p>:ownWork.reservations.length?ownWork.reservations.map(reservation=><Link key={reservation.id} href={href('/dashboard')} className="cb-work-row"><div><strong>GPU #{reservation.gpu_id}</strong><small>{new Date(reservation.start_time).toLocaleString('ko-KR')} — {new Date(reservation.end_time).toLocaleString('ko-KR')}</small></div><span className="cb-status">{reservation.status==='approved'?<CheckCircle2 size={13}/>:<Clock size={13}/>}{reservation.status==='approved'?'승인됨':'승인 대기'}</span></Link>):<p className="cb-empty">예정된 예약이 없어요. 사용 가능한 GPU를 확인해보세요.</p>}</section>
   <section className="cb-work-panel"><div className="cb-section-heading"><h2>내 서버 프로젝트</h2><Link href={href('/server')}>프로젝트 보기<ArrowRight size={14}/></Link></div>{!user?<p className="cb-empty">로그인하면 내 프로젝트를 확인할 수 있어요.</p>:ownWork?.serverError?<p role="alert" className="cb-empty">프로젝트를 불러오지 못했어요. 프로젝트 보기에서 다시 확인해 주세요.</p>:!ownWork?.projects?<p role="status" className="cb-empty">프로젝트를 불러오는 중…</p>:ownWork.projects.length?ownWork.projects.map(project=><Link key={project.id} href={href('/server/'+project.id)} className="cb-work-row"><div><strong>{project.name}</strong><small>프로젝트 상세 보기</small></div><span className="cb-status" data-state={project.phase}>{({ready:'배포 완료',building:'배포 중',queued:'배포 준비',error:'배포 실패',stopped:'중지됨',interrupted:'재배포 필요',pending:'대기 중',rejected:'배포 거절'} as Record<string,string>)[project.phase]||'상태 확인 필요'}</span></Link>):<p className="cb-empty">아직 서버 프로젝트가 없어요. 첫 서비스를 배포해보세요.</p>}</section></div>
   {user&&<FrontendActivity key={user.id}/>}
  </>}
  <section className="cb-discovery-help"><a href="https://docs.cbgpu.com"><BookOpen size={20}/><span><strong>사용법이 궁금하면</strong><small>Docs에서 시작 안내 보기</small></span><ArrowRight size={16}/></a><a href="https://arxiv.cbgpu.com"><FileText size={20}/><span><strong>학교의 연구 둘러보기</strong><small>공개 프리프린트 읽기</small></span><ArrowRight size={16}/></a></section>
 </div>;
}
