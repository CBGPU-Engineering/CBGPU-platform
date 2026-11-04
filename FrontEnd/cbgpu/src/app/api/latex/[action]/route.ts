import {NextRequest,NextResponse} from 'next/server';
import {readFile} from 'node:fs/promises';
import {publicationUser} from '@/lib/preprintsServer';
import {activeDeploymentSession} from '@/lib/deployAuth';
export const runtime='nodejs';
export const maxDuration=180;
const hosts=new Set(['cbgpu.com','researcher.cbgpu.com','app.cbgpu.com']);
const rates=new Map<string,{count:number;until:number}>();
export async function GET(req:NextRequest,ctx:{params:Promise<{action:string}>}){return handle(req,ctx)}
export async function POST(req:NextRequest,ctx:{params:Promise<{action:string}>}){return handle(req,ctx)}
async function handle(req:NextRequest,ctx:{params:Promise<{action:string}>}){
 const error=(message:string,status:number)=>NextResponse.json({error:message},{status});
 try{
  const {action}=await ctx.params;if(!['projects','inspect','import','open','new','upload-begin','upload-chunk','upload-finish','upload-cancel','trash'].includes(action))return error('Not found',404);
  const raw=req.headers.get('host')?.split(':')[0]||'';const forwarded=req.headers.get('x-cbgpu-public-host')||'';
  const host=['127.0.0.1','localhost'].includes(raw)?forwarded:raw;
  if(!hosts.has(host))return error('Not found',404);
  if(req.method==='POST'){
   const origin=req.headers.get('origin');if(origin!=='https://'+host)return error('올바르지 않은 요청입니다.',403);
  }
  const user=await publicationUser(req);if(!user||!await activeDeploymentSession(req,user.id))return error('로그인이 필요합니다.',401);
  const now=Date.now();const rate=rates.get(user.id);if(action==='upload-chunk'){}else if(rate&&rate.until>now){if(++rate.count>60)return error('요청이 많습니다. 잠시 후 다시 시도해 주세요.',429)}else rates.set(user.id,{count:1,until:now+60000});if(rates.size>2000)for(const [id,r]of rates)if(r.until<now)rates.delete(id);
  const token=req.headers.get('authorization')!.replace(/^Bearer\s+/i,'');const sid=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).session_id;
  const key=(await readFile('/home/cbgpu/CBGPU-live/backend/private/latex/bridge-key','utf8')).trim();
  const headers:Record<string,string>={'X-CBGPU-Key':key,'X-CBGPU-Identity':Buffer.from(JSON.stringify({id:user.id,session:sid,email:user.email,name:user.user_metadata?.name||user.user_metadata?.full_name||user.email})).toString('base64')};
  if(req.headers.get('content-type'))headers['Content-Type']=req.headers.get('content-type')!;
  const options:RequestInit & {duplex:'half'}={method:req.method,headers,body:req.method==='POST'?req.body:undefined,duplex:'half',cache:'no-store',signal:AbortSignal.timeout(180000)};
  const upstream=await fetch('http://127.0.0.1:3520/_api/'+action,options);
  if(upstream.status===404)return error('Project or upload not found',404);
  const text=await upstream.text();let data;try{data=JSON.parse(text)}catch{return error('논문 편집 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',502)}

  return NextResponse.json(data,{status:upstream.status});
 }catch(e){console.error('LaTeX request failed',e instanceof Error?e.name:'unknown');return error('논문 편집 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',503)}
}
