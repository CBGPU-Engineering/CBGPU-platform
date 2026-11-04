'use client';
import {useTheme} from 'next-themes';
import {useEffect,useState} from 'react';
import {Moon} from 'lucide-react';
export function WorkspaceTheme({children}:{children:React.ReactNode}){const [resolvedTheme,setResolvedTheme]=useState('light');useEffect(()=>{const sync=()=>setResolvedTheme(document.documentElement.classList.contains('dark')?'dark':'light');sync();const observer=new MutationObserver(sync);observer.observe(document.documentElement,{attributes:true,attributeFilter:['class']});return()=>observer.disconnect()},[]);return <div className="admin-developer-shell portal-publications" data-theme={resolvedTheme||'light'}>{children}</div>}
export function WorkspaceThemeControl(){const {theme,setTheme}=useTheme();return <label className="theme-control"><span className="sr-only">Color theme</span><Moon className="icon" strokeWidth={1.6}/><select aria-label="Color theme" value={theme||'system'} onChange={e=>setTheme(e.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>}
