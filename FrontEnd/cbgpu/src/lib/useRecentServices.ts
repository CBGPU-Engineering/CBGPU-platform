'use client';
import {useMemo,useSyncExternalStore} from 'react';
import {serviceGroups} from './serviceNavigation';
const services=serviceGroups.flatMap(group=>group.services);
function subscribe(callback:()=>void){window.addEventListener('storage',callback);window.addEventListener('cbgpu:recent',callback);return()=>{window.removeEventListener('storage',callback);window.removeEventListener('cbgpu:recent',callback)}}
export function useRecentServices(owner:string,mode:string){
 const key=`cbgpu-recent:${owner}:${mode}`;
 const saved=useSyncExternalStore(subscribe,()=>{try{return localStorage.getItem(key)}catch{return null}},()=>null);
 return useMemo(()=>{try{const value=JSON.parse(saved||'[]');return Array.isArray(value)?value.flatMap(href=>{const service=services.find(s=>s.href===href);return service?[service]:[]}).slice(0,5):[]}catch{return[]}},[saved]);
}
export function recordServiceVisit(owner:string,mode:string,pathname:string){
 const service=services.filter(s=>!s.href.startsWith('https:')&&(pathname===s.href||pathname.startsWith(s.href+'/'))).sort((a,b)=>b.href.length-a.href.length)[0];if(!service)return;
 const key=`cbgpu-recent:${owner}:${mode}`;
 try{const old=JSON.parse(localStorage.getItem(key)||'[]');const previous=Array.isArray(old)?old.filter((href:unknown)=>typeof href==='string'&&href!==service.href):[];localStorage.setItem(key,JSON.stringify([service.href,...previous].slice(0,5)));window.dispatchEvent(new Event('cbgpu:recent'))}catch{}
}
