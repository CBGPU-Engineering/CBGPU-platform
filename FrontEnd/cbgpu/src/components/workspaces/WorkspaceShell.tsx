'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {DropdownMenu as ModeMenu} from 'radix-ui';
import {useTheme} from 'next-themes';
import {usePathname} from 'next/navigation';
import {Home,LayoutGrid,Search,UserCircle,ArrowUpRight,ChevronDown,Check,GraduationCap,FlaskConical,Moon,Sun} from 'lucide-react';
import {useAuth} from '@/lib/useAuth';
import {recordServiceVisit} from '@/lib/useRecentServices';
import Navbar from '@/components/Navbar';
import {serviceGroups} from '@/lib/serviceNavigation';
import {workspaces,workspaceIds,isWorkspace,normalizeWorkspace,appWorkspaceHome,type WorkspaceId} from '@/lib/workspaces';
import SiteSearch from '@/components/SiteSearch';
import WorkspaceLink from './WorkspaceLink';
import AppNavigationBoundary from './AppNavigationBoundary';
import './workspaces.css';
import './audience-design.css';
import './app-layout.css';
import AccountEntry from './AccountEntry';
const Context=createContext<WorkspaceId|null>(null);
const AppContext=createContext(false);
export const useIsAppWorkspace=()=>useContext(AppContext);
export const useWorkspace=()=>useContext(Context)||'student';
export const useWorkspaceAudience=()=>useContext(Context);
const modeIcons={student:GraduationCap,researcher:FlaskConical};
const modeLabels={student:'학교생활',researcher:'연구·개발'};
const services=serviceGroups.flatMap(g=>g.services);
function saveMode(id:WorkspaceId){try{localStorage.setItem('cbgpu-workspace',id)}catch{}document.cookie=`cbgpu-workspace=${id}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`}
export default function WorkspaceShell({workspace,isApp=false,children}:{workspace:WorkspaceId;isApp?:boolean;children:React.ReactNode}){
 const [mode,setMode]=useState<WorkspaceId>(workspace),[search,setSearch]=useState(false);const pathname=usePathname();const {resolvedTheme,setTheme}=useTheme();const {user,isLoading}=useAuth();
 useEffect(()=>{if(!isLoading)recordServiceVisit(user?.id||'guest',mode,pathname)},[user?.id,isLoading,mode,pathname]);
 useEffect(()=>{if(!isApp)return;const open=()=>setSearch(true);window.addEventListener('cbgpu:open-search',open);return()=>window.removeEventListener('cbgpu:open-search',open)},[isApp]);
 useEffect(()=>{if(!isApp)return;const sync=()=>{const url=new URL(location.href),param=url.searchParams.get('mode');let saved:string|null=null;try{saved=localStorage.getItem('cbgpu-workspace')}catch{}const id=normalizeWorkspace(param)||normalizeWorkspace(saved)||workspace;setMode(id);saveMode(id);if(url.pathname==='/'&&!isWorkspace(param)){url.searchParams.set('mode',id);history.replaceState(null,'',url.pathname+url.search)}};sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync)},[isApp,workspace]);


 useEffect(()=>{if(!isApp)return;document.body.dataset.cbgpuApp='true';let baseline=window.visualViewport?.height||window.innerHeight;const sync=()=>{const el=document.activeElement as HTMLElement|null;const editing=!!el&&(el.tagName==='TEXTAREA'||(el.tagName==='INPUT'&&!['button','checkbox','radio','range','file'].includes((el as HTMLInputElement).type)));const height=window.visualViewport?.height||window.innerHeight;if(!editing)baseline=height;document.body.dataset.cbgpuKeyboard=editing&&baseline-height>150?'true':'false'};window.visualViewport?.addEventListener('resize',sync);document.addEventListener('focusin',sync);document.addEventListener('focusout',sync);return()=>{delete document.body.dataset.cbgpuApp;delete document.body.dataset.cbgpuKeyboard;window.visualViewport?.removeEventListener('resize',sync);document.removeEventListener('focusin',sync);document.removeEventListener('focusout',sync)}},[isApp]);

 const current=workspaces[mode],primary=current.primary.map(path=>services.find(s=>s.href===path)||{href:path,label:path==='/server/new'?'새 프로젝트':'SSH 접속 안내',icon:LayoutGrid});
 const active=(href:string)=>href==='/'?pathname==='/'||pathname==='/workspace':pathname===href||(pathname.startsWith(href+'/')&&!primary.some(other=>other.href!==href&&other.href.startsWith(href+'/')&&(pathname===other.href||pathname.startsWith(other.href+'/'))));
 const nav=[{href:'/',label:'홈',icon:Home},...primary.slice(0,2),{href:'/services',label:'전체 기능',icon:LayoutGrid},{href:'/profile',label:'내 정보',icon:UserCircle}];
 return <Context.Provider value={mode}><AppContext.Provider value={isApp}><div className={`cb-workspace ${isApp?'cb-app':'cb-user-workspace'}`} style={{'--workspace-accent':current.accent} as React.CSSProperties}>
  {isApp&&<AppNavigationBoundary mode={mode}/>}
  {!isApp&&<Navbar searchAudience={mode} hideBottomNav navigationLinks={primary.map(({href,label})=>({href,label}))} brandSuffix={<details className="cb-user-version" onKeyDown={event=>{if(event.key==='Escape')event.currentTarget.open=false}}><summary aria-label="CBGPU 버전 선택">{current.label}<ChevronDown size={13}/></summary><div className="cb-space-switch"><p>다른 버전으로 이동</p>{workspaceIds.map(id=>id===mode?<span key={id} aria-current="true">{workspaces[id].label}<span>현재 버전</span></span>:<WorkspaceLink key={id} href={`https://${workspaces[id].host}`}><span>{workspaces[id].label}</span><ArrowUpRight size={14}/></WorkspaceLink>)}</div></details>}/>}
  <div className="cb-workspace-body">{isApp&&<header className="cb-workspace-header cb-app-header"><a href={appWorkspaceHome(mode)} className="cb-app-brand" aria-label="CBGPU 홈"><Image src="/img/cbgpu-logo.png" width={34} height={34} alt="CBGPU"/></a><ModeMenu.Root><ModeMenu.Trigger asChild><button className="cb-app-mode-trigger" aria-label="CBGPU 버전 선택" data-current-mode={mode}><span><small>CBGPU</small><strong>{modeLabels[mode]}</strong></span><ChevronDown size={14}/></button></ModeMenu.Trigger><ModeMenu.Portal><ModeMenu.Content className="cb-app-mode-menu" align="center" sideOffset={12} collisionPadding={12}><div className="cb-mode-menu-heading"><strong>어떤 공간에서 시작할까요?</strong><span>같은 계정으로 자유롭게 바꿀 수 있어요.</span></div><ModeMenu.RadioGroup value={mode}>{workspaceIds.map(id=>{const Icon=modeIcons[id];return <ModeMenu.RadioItem key={id} value={id} onSelect={()=>{saveMode(id);window.location.assign(appWorkspaceHome(id))}} data-cbgpu-mode-option={id} className="cb-app-mode-option"><span className="cb-mode-option-icon" style={{color:workspaces[id].accent}}><Icon size={21}/></span><span><strong>{workspaces[id].label}</strong><small>{id==='student'?'자습 · 시간표 · 급식 · 자료 공유':'GPU · 웹사이트 배포 · 논문 · 제작'}</small></span><ModeMenu.ItemIndicator><Check size={17}/></ModeMenu.ItemIndicator></ModeMenu.RadioItem>})}</ModeMenu.RadioGroup><ModeMenu.Separator className="cb-mode-menu-divider"/><ModeMenu.Item aria-label="화면 테마 전환" className="cb-mode-menu-theme" onSelect={()=>setTheme(resolvedTheme==='dark'?'light':'dark')}>{resolvedTheme==='dark'?<Sun size={17}/>:<Moon size={17}/>}<span>{resolvedTheme==='dark'?'라이트 모드로 전환':'다크 모드로 전환'}</span></ModeMenu.Item></ModeMenu.Content></ModeMenu.Portal></ModeMenu.Root><div className="cb-header-actions"><button aria-label="기능 찾기" onClick={()=>setSearch(true)}><Search size={19}/></button><AccountEntry compact/></div></header>}
   <main id="main-content" className="cb-workspace-content" tabIndex={-1}>{children}</main><footer className="cb-workspace-footer"><span>CBGPU {current.name}</span><div><Link href="/download">앱 다운로드</Link><Link href="/privacy">개인정보처리방침</Link><Link href="/contact">문의하기</Link></div></footer>
  </div><nav className="cb-bottom-nav" aria-label="빠른 탐색">{nav.map(s=>isApp&&s.href==='/'?<a key={s.href} href={appWorkspaceHome(mode)} className={active(s.href)?'active':''} aria-current={active(s.href)?'page':undefined}><s.icon size={20}/><span>{s.label}</span></a>:<Link key={s.href} href={s.href} className={active(s.href)?'active':''} aria-current={active(s.href)?'page':undefined}><s.icon size={20}/><span>{s.label}</span></Link>)}</nav>{isApp&&<SiteSearch audience={mode} isApp={isApp} open={search} onOpenChange={setSearch}/>}
 </div></AppContext.Provider></Context.Provider>
}
