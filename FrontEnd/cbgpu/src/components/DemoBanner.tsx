'use client';
import {useEffect} from 'react';
export default function DemoBanner(){
 useEffect(()=>{const click=(event:MouseEvent)=>{const a=(event.target as Element)?.closest?.('a');if(!a)return;const url=new URL(a.href,location.href);if(url.origin===location.origin)return;event.preventDefault();event.stopPropagation();if(url.hostname==='docs.cbgpu.com')location.assign('/docs');else if(url.hostname==='arxiv.cbgpu.com')location.assign('/arxiv');else if(['cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com','app.cbgpu.com'].includes(url.hostname))location.assign(url.pathname+'?mode='+(url.hostname==='researcher.cbgpu.com'||url.hostname==='developer.cbgpu.com'?'researcher':'student'));else location.assign('/demo')};document.addEventListener('click',click,true);return()=>document.removeEventListener('click',click,true)},[]);
 return <aside aria-label="Local demo" className="border-b bg-amber-100 p-3 text-center text-sm text-black">LOCAL DEMO · Synthetic data · student@example.invalid or researcher@example.invalid / demo-only · Resets on restart. <a className="underline" href="/auth/login">Sign in</a></aside>
}
