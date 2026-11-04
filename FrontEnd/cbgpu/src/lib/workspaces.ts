export type WorkspaceId='student'|'researcher';
export const workspaces:Record<WorkspaceId,{name:string;label:string;eyebrow:string;description:string;host:string;accent:string;primary:string[]}>={
 student:{name:'for Students',label:'학교생활',eyebrow:'오늘 필요한 학교생활, 한곳에서.',description:'자습 신청, 시간표, 급식과 자료 공유를 바로 이용하세요.',host:'student.cbgpu.com',accent:'#4678ed',primary:['/study','/timetable','/meal','/wakeup','/materials']},
 researcher:{name:'for Research & Development',label:'연구·개발',eyebrow:'실험부터 서비스 배포까지, 한곳에서.',description:'GPU, 프론트엔드·서버 배포, 논문 작성과 제작을 함께 이용하세요.',host:'researcher.cbgpu.com',accent:'#248b70',primary:['/dashboard','/deploy','/server','/latex','/notes']},
};
export const workspaceIds:WorkspaceId[]=['student','researcher'];
export function isWorkspace(value:unknown):value is WorkspaceId{return value==='student'||value==='researcher'}
/** Old bookmarks, native clients and saved preferences still resolve to the combined space. */
export function normalizeWorkspace(value:unknown):WorkspaceId|null{return value==='developer'?'researcher':isWorkspace(value)?value:null}
export function workspaceForHost(host:string):WorkspaceId|undefined{return host==='developer.cbgpu.com'?'researcher':workspaceIds.find(id=>workspaces[id].host===host)}
export const workspaceOrigins=['https://cbgpu.com','https://www.cbgpu.com','https://app.cbgpu.com','https://student.cbgpu.com','https://researcher.cbgpu.com','https://developer.cbgpu.com'];
export function safeWorkspacePath(path:string){return path.startsWith('/')&&!path.startsWith('//')&&!/[\\\r\n]/.test(path)?path:'/'}
// Discovery preferences do not grant permissions.
export const workspaceServicePaths:Record<WorkspaceId,string[]>={
 student:['/download','/study','/timetable','/meal','/wakeup','/materials','/contests','/match','/polls','/feed','/tools','/games','https://docs.cbgpu.com'],
 researcher:['/download','/dashboard','/dashboard/ssh-guide','/deploy','/server','/latex','/notes','/materials','/manufacturing','/manufacturing/print','/manufacturing/laser','/contests','/tools','https://docs.cbgpu.com','https://arxiv.cbgpu.com'],
};
export function appWorkspaceHome(mode:WorkspaceId){return 'https://app.cbgpu.com/?mode='+mode}
