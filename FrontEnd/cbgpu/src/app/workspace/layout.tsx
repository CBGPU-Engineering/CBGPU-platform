import {headers} from 'next/headers';
import {workspaceForHost,workspaces,normalizeWorkspace} from '@/lib/workspaces';
export async function generateMetadata(){const requestHeaders=await headers();const host=requestHeaders.get('x-cbgpu-public-host')||requestHeaders.get('host')?.split(':')[0]||'app.cbgpu.com',id=workspaceForHost(host)||normalizeWorkspace(requestHeaders.get('x-cbgpu-mode'))||'student';return {title:{absolute:`CBGPU ${workspaces[id].name}`},description:workspaces[id].description,alternates:{canonical:host==='developer.cbgpu.com'?'https://researcher.cbgpu.com/':`https://${host}/`}}}
export default function Layout({children}:{children:React.ReactNode}){return children}
