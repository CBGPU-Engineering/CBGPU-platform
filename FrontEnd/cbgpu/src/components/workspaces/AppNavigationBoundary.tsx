'use client';
import {useEffect} from 'react';
import {appNavigationUrl} from '@/lib/appNavigation';
import {appWorkspaceHome,normalizeWorkspace,type WorkspaceId} from '@/lib/workspaces';
export default function AppNavigationBoundary({mode}:{mode:WorkspaceId}){
 useEffect(()=>{
  const native=()=>Boolean(window.CBGPUNative?.isNative)||new URL(location.href).searchParams.get('native')==='1';
  const owned=(url:URL)=>url.protocol==='https:'&&(!url.port||url.port==='443')&&!url.username&&!url.password&&(['app.cbgpu.com','cbgpu.com','www.cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com','docs.cbgpu.com','arxiv.cbgpu.com','latex.cbgpu.com','gpu.cbgpu.com','print.cbgpu.com','laser.cbgpu.com','manufacturing.cbgpu.com','admin.cbgpu.com','developers.cbgpu.com'].includes(url.hostname)||/^[a-z0-9][a-z0-9-]*\.(front|server)\.cbgpu\.com$/.test(url.hostname));
  const compatible=(value:string)=>{const url=new URL(value,location.href);if(native()&&['cbgpu.com','www.cbgpu.com'].includes(location.hostname)&&url.hostname==='app.cbgpu.com'){url.hostname=location.hostname;url.searchParams.set('native','1')}return url.href};
  const originals=new WeakMap<HTMLAnchorElement,{raw:string;normalized:string}>();let queued=false;
  function normalize(){queued=false;for(const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href]')){const prior=originals.get(anchor),current=anchor.getAttribute('href')||'';const raw=prior&&anchor.href===prior.normalized?prior.raw:current;const candidate=appNavigationUrl(raw,mode,location.href);const normalized=candidate?compatible(candidate):null;if(normalized){originals.set(anchor,{raw,normalized});if(anchor.href!==normalized)anchor.href=normalized}else originals.delete(anchor)}if(document.querySelector('.cb-app .cb-launch'))location.replace(appWorkspaceHome(mode))}
  const schedule=()=>{if(!queued){queued=true;queueMicrotask(normalize)}};
  const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});normalize();
  function click(event:MouseEvent){const anchor=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;if(!anchor)return;const raw=originals.get(anchor)?.raw??anchor.getAttribute('href')??anchor.href;const url=new URL(raw,location.href);const selected=normalizeWorkspace(url.searchParams.get('mode'));const candidate=appNavigationUrl(raw,mode,location.href);const crossMode=url.origin===location.origin&&selected&&selected!==mode;const sameAppPopup=native()&&owned(url)&&anchor.target==='_blank';const next=candidate?compatible(candidate):crossMode||sameAppPopup?compatible(url.href):null;if(!next)return;event.preventDefault();event.stopImmediatePropagation();if(!native()&&(event.ctrlKey||event.metaKey||event.shiftKey||event.button===1||anchor.target==='_blank'))window.open(next,'_blank','noopener');else location.assign(next)}
  const originalOpen=window.open;
  const nativeOpen:typeof window.open=(url,target,features)=>{if(url&&native()){const destination=new URL(String(url),location.href);if(owned(destination)){location.assign(compatible(appNavigationUrl(destination.href,mode,location.href)||destination.href));return window}}return originalOpen.call(window,url,target,features)};
  window.open=nativeOpen;
  document.addEventListener('click',click,true);document.addEventListener('auxclick',click,true);window.addEventListener('pageshow',schedule);
  type NavigationEvent=Event&{destination?:{url:string;sameDocument?:boolean};navigationType?:string};
  const navigation=(window as unknown as {navigation?:EventTarget}).navigation;
  const navigate=(event:Event)=>{const e=event as NavigationEvent;if(!e.destination||!e.cancelable)return;const destination=new URL(e.destination.url);if(destination.origin===location.origin&&destination.pathname===location.pathname&&destination.search===location.search)return;const candidate=appNavigationUrl(e.destination.url,mode,location.href);const next=candidate?compatible(candidate):null;if(!next)return;const internalRoot=e.destination.sameDocument&&e.navigationType!=='traverse';if(next===e.destination.url&&!internalRoot)return;e.preventDefault();if(e.navigationType==='replace')location.replace(next);else location.assign(next)};
  navigation?.addEventListener('navigate',navigate);
  return()=>{if(window.open===nativeOpen)window.open=originalOpen;observer.disconnect();document.removeEventListener('click',click,true);document.removeEventListener('auxclick',click,true);window.removeEventListener('pageshow',schedule);navigation?.removeEventListener('navigate',navigate)};
 },[mode]);return null;
}
