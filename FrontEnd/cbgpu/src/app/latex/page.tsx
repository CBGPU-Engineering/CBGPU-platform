'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {FileText,Upload,Plus,ArrowUpRight,RefreshCw,ArrowLeft,Check,Loader2,FolderOpen,X,Trash2} from 'lucide-react';
import {useAuth} from '@/lib/useAuth';
import {supabase} from '@/lib/supabase';
import './latex.css';
type Project={id:string;name:string;updated_at:string;compiler:string;role:string};
type ImportInfo={upload:string;name:string;files:string[];candidates:string[];suggested_main:string;compiler:string;warnings:string[];size:number;count:number};
async function api(action:string,body?:unknown){
 const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('로그인 후 이용해 주세요.');
 const headers:Record<string,string>={Authorization:'Bearer '+session.access_token};let payload:BodyInit|undefined;
 if(body instanceof Blob){headers['Content-Type']='application/octet-stream';payload=body;}else if(body instanceof FormData)payload=body;else if(body!==undefined){headers['Content-Type']='application/json';payload=JSON.stringify(body)}
 const response=await fetch('/api/latex/'+action,{method:body===undefined?'GET':'POST',headers,body:payload});
 const result=await response.json();if(!response.ok)throw Error(result.error||'요청을 처리하지 못했습니다.');return result;
}
export default function LatexProjects(){
 const {user,isLoading}=useAuth();const [projects,setProjects]=useState<Project[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[info,setInfo]=useState<ImportInfo|null>(null),[main,setMain]=useState(''),[compiler,setCompiler]=useState('pdflatex'),[name,setName]=useState(''),[query,setQuery]=useState(''),[drag,setDrag]=useState(false);const file=useRef<HTMLInputElement>(null);const [uploadProgress,setUploadProgress]=useState(0);
 const load=useCallback(async()=>{setLoading(true);setError('');try{setProjects((await api('projects')).projects)}catch(e){setError((e as Error).message)}finally{setLoading(false)}},[]);
 useEffect(()=>{if(user)void load()},[user,load]);
 async function inspect(selected:File){
  if(!selected.name.toLowerCase().endsWith('.zip')){setError('LaTeX 소스 ZIP 파일을 선택해 주세요.');return}
  setBusy('inspect');setError('');setInfo(null);setUploadProgress(0);
  try{const {upload}=await api('upload-begin',{name:selected.name,size:selected.size});let result:ImportInfo;try{for(let offset=0;offset<selected.size;offset+=8*1024*1024){await api('upload-chunk',new Blob([JSON.stringify({upload,offset})+'\n',selected.slice(offset,offset+8*1024*1024)]));setUploadProgress(Math.min(100,Math.round((offset+8*1024*1024)/selected.size*100)));}result=await api('upload-finish',{upload});}catch(e){await api('upload-cancel',{upload}).catch(()=>{});throw e;}setInfo(result);setMain(result.suggested_main);setCompiler(result.compiler);setName(result.name)}catch(e){setError((e as Error).message)}finally{setBusy('');if(file.current)file.current.value=''}
 }
 useEffect(()=>{
  if(!user)return;
  const refresh=()=>{if(document.visibilityState==='visible')void load()};
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
 },[user,load]);
 async function trash(project:Project){
  if(!window.confirm('“'+project.name+'” 프로젝트를 휴지통으로 이동할까요? Overleaf 휴지통에서 복원할 수 있습니다.'))return;
  setBusy('trash');setError('');try{await api('trash',{project:project.id});setProjects(current=>current.filter(p=>p.id!==project.id));}catch(e){setError((e as Error).message)}finally{setBusy('')}
 }
 const connecting=useRef(false);
 useEffect(()=>{
  const query=new URLSearchParams(location.search);const challenge=query.get('connect');if(!user||!challenge||connecting.current)return;connecting.current=true;setBusy('open');
  void api('open',{challenge,project:query.get('project')||''}).then(result=>{window.location.replace(result.url)}).catch(e=>{setError(e.message);setBusy('');connecting.current=false;history.replaceState(null,'',location.pathname+(location.hostname==='app.cbgpu.com'?'?mode=researcher':''))});
 },[user]);
 async function open(id=''){
  setBusy(id||'open');const url=new URL('https://latex.cbgpu.com/cbgpu/connect');if(id)url.searchParams.set('project',id);if(location.hostname==='app.cbgpu.com')url.searchParams.set('portal','app');window.location.assign(url.toString());
 }

 async function importProject(){
  if(!info)return;setBusy('import');setError('');try{const project=await api('import',{upload:info.upload,main,compiler,name});setInfo(null);await load();await open(project.id)}catch(e){setError((e as Error).message);setBusy('')}
 }
 async function create(){setBusy('new');setError('');try{const project=await api('new',{name:'Untitled project'});await load();await open(project.id)}catch(e){setError((e as Error).message);setBusy('')}}
 const shown=projects.filter(p=>p.name.toLowerCase().includes(query.toLowerCase()));
 return <section className="cb-page-content cb-latex">
  <header className="cb-latex-heading"><div><span className="cb-latex-eyebrow">RESEARCH WORKSPACE</span><h1>논문 작성</h1><p>아이디어를 LaTeX로 쓰고, PDF로 확인하세요.</p></div><a href="https://arxiv.cbgpu.com" className="cb-latex-text-link">프리프린트 보기 <ArrowUpRight size={16}/></a></header>
  <div className="cb-latex-intro"><div className="cb-latex-intro-icon"><FileText size={26}/></div><div><h2>익숙한 Overleaf 편집기에서.</h2><p>기존 프로젝트를 그대로 가져오거나, 빈 문서에서 시작하세요.<br/>강제 양식 없이 원래 쓰던 학술지 파일과 참고문헌을 함께 사용할 수 있어요.</p><span>자동 저장 · PDF 미리보기 · 소스 ZIP 내보내기 · 최대 5분 컴파일</span></div></div>
  {isLoading?<p role="status">로그인 확인 중…</p>:!user?<div className="cb-latex-empty"><FileText size={32}/><h2>CBGPU 계정으로 이어서 쓰세요.</h2><p>프로젝트와 파일은 로그인한 계정에 보관됩니다.</p><Link href={'/auth/login?next='+encodeURIComponent(typeof window==='undefined'?'/latex':window.location.pathname+window.location.search)} className="cb-latex-primary">로그인</Link></div>:<>
   <div className="cb-latex-actions"><div><button className="cb-latex-primary" disabled={!!busy} onClick={()=>file.current?.click()}><Upload size={17}/> ZIP 가져오기</button><button className="cb-latex-secondary" disabled={!!busy} onClick={()=>void create()}><Plus size={17}/> 빈 프로젝트</button></div><button className="cb-latex-text-link" disabled={!!busy} onClick={()=>void open()}>편집기 프로젝트 관리 <ArrowUpRight size={16}/></button></div>
   <input type="file" ref={file} accept=".zip,application/zip" className="sr-only" aria-label="LaTeX 프로젝트 ZIP" onChange={e=>{const selected=e.target.files?.[0];if(selected)void inspect(selected)}}/>
   {error&&<div role="alert" className="cb-latex-error">{error}<button onClick={()=>setError('')} aria-label="오류 닫기"><X size={16}/></button></div>}
   {busy&&<div role="status" className="cb-latex-progress"><Loader2 size={18} className="animate-spin"/>{busy==='inspect'?(uploadProgress<100?'ZIP 업로드 중… '+uploadProgress+'%':'ZIP을 검사하고 프로젝트 구조를 확인하고 있어요…'):busy==='trash'?'프로젝트를 휴지통으로 이동하고 있어요…':busy==='import'?'파일을 가져오고 프로젝트를 준비하고 있어요. 창을 닫지 말아 주세요.':busy==='new'?'빈 프로젝트를 만들고 있어요…':'편집기를 열고 있어요…'}</div>}
   {info&&<section className="cb-latex-import" aria-labelledby="import-title"><div className="cb-latex-import-title"><h2 id="import-title"><Check size={19}/> ZIP 확인 완료</h2><button className="cb-latex-text-link" disabled={!!busy} onClick={()=>setInfo(null)}><ArrowLeft size={15}/> 취소</button></div><p>{info.count}개 파일 · 압축 해제 {(info.size/1024/1024).toFixed(1)} MB · 폴더 구조 유지</p>{info.warnings.map(w=><p key={w} className="cb-latex-notice">{w}</p>)}<div className="cb-latex-import-fields"><label>프로젝트 이름<input value={name} onChange={e=>setName(e.target.value)} maxLength={120}/></label><label>메인 TeX 파일<select value={main} onChange={e=>setMain(e.target.value)}>{info.files.filter(f=>f.toLowerCase().endsWith('.tex')).map(f=><option key={f}>{f}</option>)}</select></label><label>컴파일러<select value={compiler} onChange={e=>setCompiler(e.target.value)}><option value="pdflatex">pdfLaTeX</option><option value="xelatex">XeLaTeX · 한글 / 사용자 글꼴</option><option value="lualatex">LuaLaTeX</option><option value="latex">LaTeX → PDF</option></select></label></div>{info.candidates.length>1&&<p className="cb-latex-notice">실행 가능한 TeX 파일이 여러 개입니다. 실제 논문의 시작 파일을 골라 주세요.</p>}<details><summary>포함된 파일 보기</summary><ul>{info.files.map(f=><li key={f}><code>{f}</code></li>)}</ul></details><button className="cb-latex-primary" disabled={!!busy||!name.trim()} onClick={()=>void importProject()}>가져오고 편집기 열기 <ArrowUpRight size={17}/></button></section>}
   <section className="cb-latex-projects"><div className="cb-latex-list-heading"><h2>내 프로젝트 <span>{projects.length}</span></h2><button className="cb-latex-text-link" disabled={loading||!!busy} onClick={()=>void load()} aria-label="프로젝트 새로고침"><RefreshCw size={17}/></button></div><input className="cb-latex-search" placeholder="프로젝트 검색" aria-label="프로젝트 검색" value={query} onChange={e=>setQuery(e.target.value)}/>
   {loading?<p role="status">프로젝트 불러오는 중…</p>:projects.length===0?<div className={'cb-latex-drop'+(drag?' is-dragging':'')} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);if(!busy&&e.dataTransfer.files[0])void inspect(e.dataTransfer.files[0])}}><FolderOpen size={32}/><h3>첫 논문을 가져와 보세요.</h3><p>Overleaf의 Menu → Download → Source에서 받은 ZIP을<br/>여기에 놓거나, ZIP 가져오기를 누르세요.</p><small>파일 크기 제한 없음 · 최대 1,000개 파일</small></div>:shown.length===0?<p className="cb-latex-empty">검색 결과가 없습니다.</p>:<ul className="cb-latex-project-list">{shown.map(p=><li key={p.id}><button disabled={!!busy} onClick={()=>void open(p.id)}><span className="cb-latex-file-icon"><FileText size={21}/></span><span className="cb-latex-project-name"><strong>{p.name}</strong><small>{p.compiler||'pdflatex'} · {p.role==='owner'?'내 프로젝트':'공유 프로젝트'} · {new Date(p.updated_at).toLocaleDateString('ko-KR')}</small></span><ArrowUpRight size={18}/></button>{p.role==='owner'&&<button className="cb-latex-trash" disabled={!!busy} aria-label={p.name+' 삭제'} title="휴지통으로 이동" onClick={()=>void trash(p)}><Trash2 size={18}/></button>}</li>)}</ul>}</section>
  </>}
  <p className="cb-latex-footnote">Overleaf Community Edition 기반 · 편집기에서 PDF와 소스 ZIP을 내려받을 수 있습니다. ZIP 가져오기 실패 시 기존 프로젝트는 유지됩니다.</p>
 </section>
}
