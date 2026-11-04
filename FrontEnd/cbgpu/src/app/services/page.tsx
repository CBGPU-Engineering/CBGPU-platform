'use client';
import {useSearchParams} from 'next/navigation';
import ServiceDirectory from '@/components/services/ServiceDirectory';
import {useWorkspaceAudience,useIsAppWorkspace} from '@/components/workspaces/WorkspaceShell';
export default function ServicesPage(){const mode=useWorkspaceAudience(),isApp=useIsAppWorkspace(),params=useSearchParams();return <div className="cb-service-page"><ServiceDirectory key={params.toString()} audience={mode} isApp={isApp} initialQuery={params.get('q')||''} initialCategory={params.get('category')||'all'}/></div>}
