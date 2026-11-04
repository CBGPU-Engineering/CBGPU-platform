import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readJsonBody,WindowRateLimiter} from '@/lib/requestSecurity';
import {workspaceOrigins} from '@/lib/workspaces';
export const runtime='nodejs';
const origins=new Set(workspaceOrigins);
const cookie='__Secure-cbgpu-workspace-handoff';
type Session={access_token:string;refresh_token:string};
type Ticket={target:string;proof:Buffer;session:Session;expires:number;user:string};
const tickets=new Map<string,Ticket>(),limits=new WindowRateLimiter(30,60_000);
const hash=(value:string)=>createHash('sha256').update(value).digest();
function response(body:unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})}
export async function POST(req:NextRequest){
 const origin=req.headers.get('origin'),host=req.headers.get('host')?.split(':')[0],expected=`https://${host}`;
 if(!origin||origin!==expected||!origins.has(origin))return response({message:'Invalid origin.'},403);
 if(!limits.allow(req.headers.get('cf-connecting-ip')||'local'))return response({message:'Please try again shortly.'},429);
 for(const [key,value] of tickets)if(value.expires<Date.now())tickets.delete(key);
 let body:Record<string,unknown>;try{body=await readJsonBody(req,12_000) as Record<string,unknown>}catch{return response({message:'Invalid request.'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return response({message:'Invalid request.'},400);
 if(body.action==='create'){
  const target=String(body.target||''),refresh=String(body.refresh_token||''),token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!origins.has(target)||target===origin||!token||refresh.length<10||refresh.length>4096)return response({message:'Invalid destination or session.'},400);
  if(tickets.size>=500)return response({message:'Please try again shortly.'},503);
  try{
   const options={auth:{persistSession:false,autoRefreshToken:false}};
   const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,options);
   const verified=await client.auth.getUser(token),user=verified.data.user;
   if(verified.error||!user?.email)return response({message:'Please sign in again.'},401);
   // A JWT can outlive logout. Require a live refresh credential too, so a
   // revoked session cannot mint new sessions through this endpoint.
   const refreshed=await client.auth.refreshSession({refresh_token:refresh});
   if(refreshed.error||!refreshed.data.session||refreshed.data.user?.id!==user.id)return response({message:'Please sign in again.'},401);
   const source_session:Session={access_token:refreshed.data.session.access_token,refresh_token:refreshed.data.session.refresh_token};
   const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!serviceKey)return response({message:'Sign-in connection unavailable.'},503);
   const authAdmin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,serviceKey,options);
   // generateLink does not send mail. Verify its server-only hash to create
   // a separate destination session rather than sharing rotating credentials.
   const generated=await authAdmin.auth.admin.generateLink({type:'magiclink',email:user.email});
   if(generated.error||generated.data.user?.id!==user.id||!generated.data.properties?.hashed_token)return response({message:'Could not connect your account.',source_session},503);
   const signed=await client.auth.verifyOtp({type:'magiclink',token_hash:generated.data.properties.hashed_token});
   if(signed.error||!signed.data.session||signed.data.user?.id!==user.id)return response({message:'Could not connect your account.',source_session},503);
   for(const [key,value] of tickets)if(value.user===user.id)tickets.delete(key);
   const code=randomBytes(32).toString('base64url'),proof=randomBytes(32).toString('base64url');
   tickets.set(hash(code).toString('hex'),{target,proof:hash(proof),session:{access_token:signed.data.session.access_token,refresh_token:signed.data.session.refresh_token},expires:Date.now()+60_000,user:user.id});
   const out=response({code,source_session});out.cookies.set(cookie,proof,{httpOnly:true,secure:true,sameSite:'strict',domain:'cbgpu.com',path:'/api/workspaces/session',maxAge:60});return out;
  }catch{return response({message:'Sign-in connection temporarily unavailable.'},503)}
 }
 if(body.action==='consume'){
  const code=String(body.code||'');if(!/^[\w-]{43}$/.test(code))return response({message:'This sign-in link has expired.'},400);
  const key=hash(code).toString('hex'),ticket=tickets.get(key),proof=req.cookies.get(cookie)?.value;
  if(!ticket||ticket.expires<Date.now()||ticket.target!==origin||!proof||!timingSafeEqual(ticket.proof,hash(proof)))return response({message:'This sign-in link has expired. Please sign in here.'},401);
  tickets.delete(key);const out=response(ticket.session);out.cookies.set(cookie,'',{httpOnly:true,secure:true,sameSite:'strict',domain:'cbgpu.com',path:'/api/workspaces/session',maxAge:0});return out;
 }
 return response({message:'Invalid request.'},400);
}
