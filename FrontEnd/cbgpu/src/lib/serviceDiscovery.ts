import {workspaceServicePaths,workspaces,type WorkspaceId} from './workspaces';
export function serviceAudience(href:string):WorkspaceId{return workspaceServicePaths.student.some(path=>href===path||href.startsWith(path+'/'))?'student':'researcher'}
/** A cross-space link carries its destination mode, including inside the native app. */
export function serviceDestination(href:string,audience:WorkspaceId|null,isApp=false){
 if(href.startsWith('https:'))return href;
 const target=audience&&workspaceServicePaths[audience].some(path=>href===path||href.startsWith(path+'/'))?audience:serviceAudience(href);
 if(isApp)return href+'?mode='+target+'&native=1';
 if(audience===target)return href;
 return 'https://'+workspaces[target].host+href;
}
export function matchesService(query:string,text:string){
 const normalize=(value:string)=>value.toLocaleLowerCase().normalize('NFKC');
 const haystack=normalize(text),compact=haystack.replace(/\s+/g,'');
 return normalize(query).trim().split(/\s+/).filter(Boolean).every(word=>haystack.includes(word)||compact.includes(word));
}
