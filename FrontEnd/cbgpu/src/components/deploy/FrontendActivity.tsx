'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,Globe} from 'lucide-react';
import {supabase} from '@/lib/supabase';
type Project={id:string;slug:string;domain:string;deployments:{status:string}[]};
export default function FrontendActivity(){
 const [projects,setProjects]=useState<Project[]|null>(null),[error,setError]=useState(false);
 useEffect(()=>{let live=true;const load=async()=>{try{const {data:{session}}=await supabase.auth.getSession();if(!session)return;const response=await fetch('/api/deploy/projects',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();if(live){setProjects(data.projects);setError(false)}}catch{if(live)setError(true)}};void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load()},30000);return()=>{live=false;clearInterval(timer)}},[]);
 const labels:Record<string,string>={ready:'배포 완료',building:'빌드 중',queued:'대기 중',error:'배포 실패'};
 return <section className="cb-work-panel cb-home-frontend"><div className="cb-section-heading"><h2><Globe size={18}/>프론트엔드 프로젝트</h2><Link href="/deploy">전체 보기<ArrowRight size={14}/></Link></div>{error?<p className="cb-empty" role="alert">배포 정보를 불러오지 못했습니다. 전체 보기에서 다시 확인해 주세요.</p>:projects===null?<p className="cb-empty" role="status">배포 정보를 불러오는 중…</p>:projects.length?projects.slice(0,5).map(project=><Link href={'/deploy/'+project.id} key={project.id} className="cb-work-row"><div><strong>{project.slug}</strong><small>{project.domain}</small></div><span className="cb-status">{labels[project.deployments[0]?.status]||'배포 대기'}</span></Link>):<p className="cb-empty">첫 웹사이트를 배포해보세요. Git 저장소만 있으면 시작할 수 있습니다.</p>}</section>
}
