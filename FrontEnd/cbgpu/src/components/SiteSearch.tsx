'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {workspaceServicePaths,workspaces,type WorkspaceId} from '@/lib/workspaces';
import {serviceSearchPages} from '@/lib/serviceNavigation';
import {matchesService,serviceAudience,serviceDestination} from '@/lib/serviceDiscovery';
import WorkspaceLink from '@/components/workspaces/WorkspaceLink';
import {Search,ArrowRight} from 'lucide-react';
const PAGES=[...serviceSearchPages,{title:'전체 기능',description:'필요한 기능을 분류별로 찾아보기',href:'/services',keywords:'전체 메뉴 기능 서비스'},{title:'내 프로필',description:'계정 정보 확인',href:'/profile',keywords:'계정 개인정보'},{title:'문의하기',description:'문제와 제안 보내기',href:'/contact',keywords:'문의 지원'}];
export default function SiteSearch({open,onOpenChange,audience,isApp=false}:{open:boolean;onOpenChange:(open:boolean)=>void;audience?:WorkspaceId;isApp?:boolean}){
 const dialogRef=useRef<HTMLDialogElement>(null),inputRef=useRef<HTMLInputElement>(null),resultsRef=useRef<HTMLDivElement>(null);
 const [query,setQuery]=useState(''),[selected,setSelected]=useState(0);
 const isService=(href:string)=>serviceSearchPages.some(page=>page.href===href);
 const relevant=(href:string)=>!audience||!isService(href)||workspaceServicePaths[audience].includes(href);
 const results=query.trim()?PAGES.filter(page=>matchesService(query,`${page.title} ${page.description} ${page.keywords}`)).sort((a,b)=>Number(relevant(b.href))-Number(relevant(a.href))):PAGES.filter(page=>relevant(page.href));
 useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;if(open&&!dialog.open){dialog.showModal();requestAnimationFrame(()=>inputRef.current?.focus())}else if(!open&&dialog.open)dialog.close()},[open]);
 useEffect(()=>{const shortcut=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'&&!event.repeat){event.preventDefault();onOpenChange(!dialogRef.current?.open)}};window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut)},[open,onOpenChange]);
 function close(){onOpenChange(false);setQuery('');setSelected(0)}
 return <dialog ref={dialogRef} onCancel={()=>onOpenChange(false)} onClose={()=>{if(!dialogRef.current?.open)onOpenChange(false)}} onClick={event=>{if(event.target===dialogRef.current)close()}} aria-label="기능 찾기" className="site-search fixed inset-0 m-auto w-[min(92vw,36rem)] max-h-[min(80vh,42rem)] rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl">
  <div className="flex items-center gap-3 border-b border-border px-4 py-3"><Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true"/><input ref={inputRef} type="search" value={query} onChange={event=>{setQuery(event.target.value);setSelected(0)}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return}if(event.key==='ArrowDown'){event.preventDefault();setSelected(index=>Math.min(index+1,Math.max(results.length-1,0)))}if(event.key==='ArrowUp'){event.preventDefault();setSelected(index=>Math.max(index-1,0))}if(event.key==='Enter'){event.preventDefault();resultsRef.current?.querySelectorAll<HTMLAnchorElement>('[data-search-row] a')[selected]?.click()}}} placeholder="이름을 몰라도, 하고 싶은 일을 검색하세요" aria-label="기능 검색" data-no-focus-ring className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground"/><button type="button" onClick={close} className="rounded-md border border-border px-2 py-2 text-xs text-muted-foreground min-h-11">닫기</button></div>
  <div ref={resultsRef} className="thin-scroll max-h-[min(65vh,34rem)] overflow-y-auto p-2">{results.length===0?<p className="px-4 py-10 text-center text-sm text-muted-foreground">찾는 기능이 없어요. ‘자료’, ‘프린터’, ‘웹사이트’로 검색해보세요.</p>:results.map((page,index)=>{const href=isService(page.href)?serviceDestination(page.href,audience||null,isApp):page.href;const other=!relevant(page.href),content=<><span className="min-w-0"><span className="block font-semibold">{page.title}{other&&<small className="ml-2 text-xs font-normal text-muted-foreground">{workspaces[serviceAudience(page.href)].label}</small>}</span><span className="block text-xs text-muted-foreground leading-6">{page.description}</span></span><ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true"/></>;
   const props={className:`site-search-item flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors ${selected===index?'bg-primary/10':'hover:bg-muted'}`,onMouseEnter:()=>setSelected(index)};
   return <div key={page.href} data-search-row onMouseEnter={props.onMouseEnter}>{href.startsWith('https:')?<WorkspaceLink href={href} className={props.className}><span data-search-result-content className="contents">{content}</span></WorkspaceLink>:<Link data-search-result href={href} className={props.className} onClick={close}>{content}</Link>}</div>;
  })}</div>
 </dialog>;
}
