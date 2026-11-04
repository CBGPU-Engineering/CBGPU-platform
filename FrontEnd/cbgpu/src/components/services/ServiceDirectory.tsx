'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Search,X,ArrowUpRight,ArrowRight,LayoutGrid} from 'lucide-react';
import {serviceGroups} from '@/lib/serviceNavigation';
import {workspaceServicePaths,workspaces,appWorkspaceHome,type WorkspaceId} from '@/lib/workspaces';
import {matchesService,serviceDestination} from '@/lib/serviceDiscovery';
import WorkspaceLink from '@/components/workspaces/WorkspaceLink';
import './service-directory.css';
export default function ServiceDirectory({audience=null,isApp=false,initialQuery='',initialCategory='all',home=false}:{audience?:WorkspaceId|null;isApp?:boolean;initialQuery?:string;initialCategory?:string;home?:boolean}){
 const [query,setQuery]=useState(initialQuery),[category,setCategory]=useState(()=>serviceGroups.some(group=>group.id===initialCategory&&group.services.some(service=>!audience||workspaceServicePaths[audience].includes(service.href)))?initialCategory:'all');
 const relevant=(href:string)=>!audience||workspaceServicePaths[audience].includes(href);
 const available=serviceGroups.map(group=>({...group,services:group.services.filter(service=>relevant(service.href))})).filter(group=>group.services.length).map(group=>({...group,title:audience==='researcher'&&group.id==='school'?'자료 공유':group.title})).sort((a,b)=>audience==='researcher'?['compute','deploy','research','making','school','community','knowledge'].indexOf(a.id)-['compute','deploy','research','making','school','community','knowledge'].indexOf(b.id):0);
 const groups=available.filter(group=>category==='all'||category===group.id).map(group=>({...group,services:group.services.filter(service=>matchesService(query,`${service.label} ${service.description} ${service.keywords||''} ${service.href}`))})).filter(group=>group.services.length);
 const count=groups.reduce((sum,group)=>sum+group.services.length,0);
 const others=query.trim()&&audience?serviceGroups.flatMap(group=>group.services.filter(service=>!relevant(service.href)&&matchesService(query,`${service.label} ${service.description} ${service.keywords||''} ${service.href}`))):[];
 function tile(service:typeof serviceGroups[number]['services'][number],group:string){const href=serviceDestination(service.href,audience,isApp);const content=<><span className={'cb-directory-icon cb-directory-icon-'+group}><service.icon size={22} strokeWidth={1.7}/></span><span className="cb-directory-copy"><strong>{service.label}</strong><small>{service.description}</small></span><ArrowUpRight size={15} className="cb-directory-arrow"/></>;return href.startsWith('https:')?<WorkspaceLink key={service.href} href={href} className="cb-directory-tile">{content}</WorkspaceLink>:<Link key={service.href} href={href} className="cb-directory-tile">{content}</Link>}
 return <section className={'cb-directory'+(home?' cb-directory-home':'')} aria-label="기능 찾아보기">
  <div className="cb-directory-heading"><div><h2>{home?'무엇이 필요한가요?':'전체 기능'}</h2><p>{audience==='student'?'학교에서 자주 쓰는 기능부터, 필요한 일을 바로 찾아보세요.':'GPU 사용부터 웹사이트 배포, 논문과 제작까지.'}</p></div>{home&&<Link href="/services">전체 기능<ArrowRight size={15}/></Link>}</div>
  <div className="cb-directory-search"><Search size={21} aria-hidden="true"/><input type="search" aria-label="기능 검색" placeholder={audience==='student'?'자습, 급식, 자료… 무엇을 찾고 있나요?':'GPU, 배포, 논문, 프린터… 검색하세요'} value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Escape')setQuery('')}}/>{query&&<button type="button" aria-label="검색어 지우기" onClick={()=>setQuery('')}><X size={18}/></button>}</div>
  <nav className="cb-directory-filters" aria-label="기능 분류"><button type="button" onClick={()=>setCategory('all')} aria-pressed={category==='all'}><LayoutGrid size={15}/>전체</button>{available.map(group=><button key={group.id} type="button" onClick={()=>setCategory(group.id)} aria-pressed={category===group.id}>{group.title}</button>)}</nav>
  {query.trim()&&<p className="cb-directory-result" role="status" aria-live="polite">‘{query}’ 검색 결과 · {count+others.length}개</p>}
  <div className="cb-directory-sections">{groups.map(group=><section key={group.id} aria-labelledby={'service-group-'+group.id}><h3 id={'service-group-'+group.id}>{group.title}<span>{group.services.length}</span></h3><div className="cb-directory-grid" data-count={group.services.length}>{group.services.map(service=>tile(service,group.id))}</div></section>)}</div>
  {others.length>0&&<section className="cb-directory-other"><h3>다른 공간에서 찾았어요</h3><p>선택하면 해당 기능이 있는 공간으로 이동해요.</p><div className="cb-directory-grid" data-count={others.length}>{others.map(service=>tile(service,'other'))}</div></section>}
  {!count&&!others.length&&<div className="cb-directory-empty"><Search size={25}/><h3>찾는 기능이 보이지 않나요?</h3><p>‘프린터’, ‘자료’, ‘웹사이트’처럼 하고 싶은 일을 검색해보세요.</p><button type="button" onClick={()=>{setQuery('');setCategory('all')}}>검색과 분류 초기화<ArrowRight size={16}/></button></div>}
  {audience&&<div className="cb-directory-switch"><span>{audience==='student'?'GPU·배포·논문·제작을 찾고 있나요?':'자습·시간표·급식을 찾고 있나요?'}</span><WorkspaceLink href={isApp?appWorkspaceHome(audience==='student'?'researcher':'student'):'https://'+workspaces[audience==='student'?'researcher':'student'].host}>{audience==='student'?'연구·개발 공간':'학교생활 공간'}<ArrowRight size={15}/></WorkspaceLink></div>}
 </section>;
}
