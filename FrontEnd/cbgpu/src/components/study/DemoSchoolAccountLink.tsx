'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
export default function DemoSchoolAccountLink({onConnected}:{onConnected:(token:string)=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function connect(){
  setBusy(true);
  try{
   const payload=btoa(JSON.stringify({userId:'demo-school-student',exp:4102444800})).replaceAll('=','').replaceAll('+','-').replaceAll('/','_');
   await onConnected('demo.'+payload+'.not-a-real-signature');
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <div className="space-y-3"><p>This is a synthetic school account. No EduSet login or live school request is made.</p><Button disabled={busy} onClick={()=>void connect()}>Connect demo student</Button>{error&&<p role="alert">{error}</p>}</div>
}
