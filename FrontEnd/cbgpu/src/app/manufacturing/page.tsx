import {redirect} from 'next/navigation';
import {normalizeWorkspace} from '@/lib/workspaces';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams,query=new URLSearchParams();
 const mode=normalizeWorkspace(params.mode);if(mode)query.set('mode',mode);
 if(params.native==='1')query.set('native','1');
 redirect('/manufacturing/print'+(query.size?'?'+query.toString():''));
}
