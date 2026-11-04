'use client';
import Link from 'next/link';
import {useState} from 'react';
import {usePathname} from 'next/navigation';
import {BookOpen,FileText,Plus,ChevronDown} from 'lucide-react';
type Item={href:string;internalPath:string;label:string;kind:'docs'|'papers'|'submit';group?:string};
export default function PublicationNav({items}:{items:Item[]}){
 const pathname=usePathname(),[expanded,setExpanded]=useState(false);
 const active=(item:Item)=>pathname===item.href||pathname===item.internalPath||(item.kind==='papers'&&pathname!=='/submit'&&pathname!=='/arxiv/submit');
 function entry(item:Item){const Icon=item.kind==='submit'?Plus:item.kind==='papers'?FileText:BookOpen;return <Link key={item.href} href={item.href} onClick={()=>setExpanded(false)} className={`nav-item${active(item)?' active':''}`} aria-current={active(item)?'page':undefined}><Icon className="icon" strokeWidth={1.6} aria-hidden="true"/><span>{item.label}</span></Link>}
 const groups=[...new Set(items.flatMap(item=>item.group?[item.group]:[]))];
 const navigation=<nav id={groups.length?'docs-sidebar-nav':undefined} className="navigation" aria-label="워크스페이스 탐색">{items.filter(item=>!item.group).map(entry)}{groups.map(group=><details className="docs-nav-group" key={group} open={items.some(item=>item.group===group&&active(item))}><summary>{group}</summary><div>{items.filter(item=>item.group===group).map(entry)}</div></details>)}</nav>;
 return groups.length?<div className="docs-sidebar-navigation" data-expanded={expanded}><button type="button" className="docs-sidebar-toggle" aria-expanded={expanded} aria-controls="docs-sidebar-nav" onClick={()=>setExpanded(value=>!value)}><BookOpen className="size-4"/><span>문서 목록</span><ChevronDown className="size-4"/></button>{navigation}</div>:navigation;
}
