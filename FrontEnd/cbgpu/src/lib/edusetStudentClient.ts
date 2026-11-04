import 'server-only';
import {StudyFailure} from './edusetStudent';
const allowedPath=/^\/(?:users\/[A-Za-z0-9_-]+|students\/[A-Za-z0-9_-]+|policies\/selfstudy|rooms(?:\/[A-Za-z0-9_-]+\/composition)?|teachers|selfstudy(?:\/search|\/[A-Za-z0-9_-]+)?)$/;
export async function sendSchoolStudent(path:string,token:string,method='GET',body?:unknown){
 if(!allowedPath.test(path))throw new StudyFailure('지원하지 않는 요청입니다.',400);
 const challenge=path==='/auth/signin'&&(body as {turnstileResponse?:string})?.turnstileResponse;
 const response=await fetch('https://api.cbsh.edu-set.com'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token,'x-jwt':token}:{}),...(challenge?{'X-Turnstile-Response':challenge}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15_000)});
 const data=await response.json().catch(()=>null);
 if(!response.ok){const message=Array.isArray(data?.message)?data.message.join(' · '):data?.message;throw new StudyFailure(typeof message==='string'?message.slice(0,600):'EduSet에서 요청을 거절했습니다.',response.status>=500?502:response.status)}
 return data;
}
