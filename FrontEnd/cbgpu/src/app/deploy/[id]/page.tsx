import DeployConsole from '@/components/deploy/DeployConsole';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <DeployConsole view="detail" projectId={id}/>}
