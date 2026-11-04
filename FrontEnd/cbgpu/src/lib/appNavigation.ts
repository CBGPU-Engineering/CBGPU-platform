import {normalizeWorkspace,workspaceForHost,type WorkspaceId} from './workspaces';
const coreHosts=new Set(['cbgpu.com','www.cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com']);
/** Top-level UI navigation only: backend fetch requests keep their original endpoints. */
export function appNavigationUrl(input:string,mode:WorkspaceId,base='https://app.cbgpu.com/'){
 if(input.trim().startsWith('#'))return null;
 let target:URL;try{target=new URL(input,base)}catch{return null}
 if(!['http:','https:'].includes(target.protocol))return null;
 target.hostname=target.hostname.replace(/\.$/,'');
 const root=target.hostname==='app.cbgpu.com'&&['/','/workspace'].includes(target.pathname);
 if(!root&&!coreHosts.has(target.hostname))return null;
 const selected=workspaceForHost(target.hostname)||(normalizeWorkspace(target.searchParams.get('mode'))||mode);
 target.protocol='https:';target.hostname='app.cbgpu.com';target.port='';target.username='';target.password='';if(target.pathname==='/workspace')target.pathname='/';target.searchParams.set('mode',selected);
 return target.href;
}
