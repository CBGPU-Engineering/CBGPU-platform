'use client';
import {usePathname,useRouter} from 'next/navigation';
import {useIsAppWorkspace,useWorkspace} from '@/components/workspaces/WorkspaceShell';
import {SegmentedTabs} from '@/components/ui/segmented-tabs';
const tabs=[{value:'print',label:'3D 프린팅'},{value:'laser',label:'레이저 커팅'}];
export default function ManufacturingNavigation(){
 const path=usePathname(),router=useRouter(),isApp=useIsAppWorkspace(),mode=useWorkspace();
 if(!['/manufacturing','/manufacturing/print','/manufacturing/laser'].includes(path))return null;
 const selected=path==='/manufacturing/laser'?'laser':'print';
 return <div className="space-y-6 mb-8"><div className="space-y-1"><h1 className="text-4xl font-black tracking-tighter italic uppercase">제작</h1><p className="text-muted-foreground font-bold uppercase text-xs tracking-widest opacity-60">3D Printing · Laser Cutting</p></div><SegmentedTabs items={tabs} value={selected} label="제작 워크스페이스 선택" onChange={value=>router.push('/manufacturing/'+value+(isApp?'?mode='+mode:''))}/></div>;
}
