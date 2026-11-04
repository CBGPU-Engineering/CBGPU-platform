'use client';
import {useState,useSyncExternalStore} from 'react';
import Link from 'next/link';
import SiteSearch from '@/components/SiteSearch';
import {ArrowUpRight,Search,GraduationCap,FlaskConical,Code2} from 'lucide-react';
import {useHomeGreeting} from '@/lib/useHomeGreeting';
import {useAuth} from '@/lib/useAuth';
import {workspaces,workspaceIds} from '@/lib/workspaces';
import WorkspaceLink from './WorkspaceLink';
function subscribe(callback:()=>void){window.addEventListener('storage',callback);return()=>window.removeEventListener('storage',callback)}
export default function LaunchStart(){
 const {user,profile,isLoading}=useAuth();const [search,setSearch]=useState(false);
 const icons={student:GraduationCap,researcher:FlaskConical,developer:Code2};
 const greeting=useHomeGreeting();
 const saved=useSyncExternalStore(subscribe,()=>{try{return localStorage.getItem('cbgpu-workspace')}catch{return null}},()=>null);
 return <section className="cb-launch-start" aria-label="빠른 시작"><div className="cb-launch-start-heading"><div><strong>{isLoading?'안녕하세요':user?`${profile?.full_name||user.user_metadata?.full_name||'사용자'}님, ${greeting}`:greeting}</strong><p>오늘은 뭘 도와드릴까요?</p></div><button onClick={()=>setSearch(true)} aria-haspopup="dialog"><Search size={18}/><span>기능 찾기</span><kbd>⌘ / Ctrl K</kbd></button></div><div className="cb-launch-start-links">{workspaceIds.map(id=>{const Icon=icons[id];return <WorkspaceLink key={id} href={`https://${workspaces[id].host}`}><span className="cb-start-icon" style={{color:workspaces[id].accent}}><Icon size={23}/></span><span><strong>{workspaces[id].name}</strong><small>{id==='student'?'시간표 · 급식 · 자습':'GPU · 배포 · 논문 · 제작'}</small>{saved===id&&<em>최근 사용</em>}</span><ArrowUpRight size={18}/></WorkspaceLink>})}</div><div className="cb-launch-start-footer"><span>하나의 계정으로 자유롭게 이동하세요.</span><Link href="/services">전체 서비스 보기<ArrowUpRight size={14}/></Link></div><SiteSearch open={search} onOpenChange={setSearch}/></section>
}
