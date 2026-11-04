import 'server-only';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
/** A logged-out session must not keep deploying with a still-unexpired JWT. */
export async function activeDeploymentSession(request:Request,userId:string){
 const token=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];if(!token||!/^[a-f0-9-]{36}$/.test(userId))return false;
 let sessionId:unknown;try{sessionId=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).session_id}catch{return false}if(typeof sessionId!=='string'||!/^[a-f0-9-]{36}$/.test(sessionId))return false;
 const query=`SELECT EXISTS(SELECT 1 FROM auth.sessions WHERE id='${sessionId}'::uuid AND user_id='${userId}'::uuid AND (not_after IS NULL OR not_after>now()))`;
 const result=await run('/usr/bin/docker',['exec','cbgpu-supabase-db','psql','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1','-c',query],{timeout:5000,maxBuffer:1000});return result.stdout.trim()==='t';
}
