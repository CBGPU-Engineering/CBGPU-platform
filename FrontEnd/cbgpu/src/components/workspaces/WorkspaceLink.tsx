'use client';
import {useState} from 'react';
import {supabase} from '@/lib/supabase';
import {workspaceOrigins} from '@/lib/workspaces';
const hosts=new Set(workspaceOrigins.map(origin=>new URL(origin).hostname));
export default function WorkspaceLink({href,children,className}:{href:string;children:React.ReactNode;className?:string}){
 const [busy,setBusy]=useState(false);
 return <a href={href} className={className} aria-busy={busy} onClick={async event=>{
  if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
  const target=new URL(href,window.location.origin);if(!hosts.has(target.hostname)||target.origin===location.origin)return;
  event.preventDefault();if(busy)return;setBusy(true);
  try{const {data:{session}}=await supabase.auth.getSession();if(session){const response=await fetch('/api/workspaces/session',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action:'create',target:target.origin,refresh_token:session.refresh_token})});const data=await response.json();if(data.source_session)await supabase.auth.setSession(data.source_session);if(response.ok){const {code}=data;const transfer=new URL('/auth/transfer',target.origin);transfer.searchParams.set('code',code);transfer.searchParams.set('next',target.pathname+target.search+target.hash);window.location.assign(transfer.href);return}}window.location.assign(target.href)}catch{window.location.assign(target.href)}finally{setBusy(false)}
 }}>{children}</a>
}
