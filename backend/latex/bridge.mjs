// Trusted, private CBGPU adapter. This port is never routed to the Internet.
import http from 'node:http'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import Settings from '@overleaf/settings'
import mongoose from './app/src/infrastructure/Mongoose.mjs'
import {User} from './app/src/models/User.mjs'
import {Project} from './app/src/models/Project.mjs'
import Registration from './app/src/Features/User/UserRegistrationHandler.mjs'
import Sessions from './app/src/Features/User/UserSessionsRedis.mjs'
import Auth from './app/src/Features/Authentication/AuthenticationController.mjs'
import Upload from './app/src/Features/Uploads/ProjectUploadManager.mjs'
import Deleter from './app/src/Features/Project/ProjectDeleter.mjs'
import RootDoc from './app/src/Features/Project/ProjectRootDocManager.mjs'
import UserSessions from './app/src/Features/User/UserSessionsManager.mjs'
const key=(await fs.readFile('/cbgpu/bridge-key','utf8')).trim(),redis=Sessions.client()
await mongoose.connectionPromise
const inFlight=new Map()
async function getUser(input){
 if(!/^[a-f0-9-]{36}$/.test(input.id)||!input.email?.includes('@'))throw Error('Invalid identity')
 if(inFlight.has(input.id))return inFlight.get(input.id)
 const task=(async()=>{
  const collection=mongoose.connection.db.collection('cbgpu_users')
  const mapping=await collection.findOne({_id:input.id})
  if(mapping){const user=await User.findById(mapping.overleafId).exec();if(!user)throw Error('Account unavailable');return user}
  // Use an immutable per-CBGPU-ID identity. Never associate by user-editable name/email.
  const email=input.id+'@accounts.cbgpu.com'
  let user=await User.findOne({email}).exec()
  if(!user)user=await Registration.promises.registerNewUser({email,password:crypto.randomBytes(32).toString('hex'),first_name:String(input.name||input.email).slice(0,100),last_name:'',analyticsId:crypto.randomUUID()})
  await User.updateOne({_id:user._id},{$set:{'emails.0.confirmedAt':new Date(),'features.compileTimeout':300}})
  await collection.updateOne({_id:input.id},{$set:{overleafId:user._id,contactEmail:input.email}},{upsert:true});return user
 })();inFlight.set(input.id,task)
 try{return await task}finally{inFlight.delete(input.id)}
}
http.createServer(async(req,res)=>{
 try{
  if(req.headers.authorization!=='Bearer '+key){res.writeHead(403);return res.end()}
  let body='';for await(const part of req){body+=part;if(body.length>65536)throw Error('Too large')}
  const input=JSON.parse(body||'{}');const user=await getUser(input.user)
  let result
  if(req.url==='/session'){
   const sid=crypto.randomBytes(32).toString('base64url'),maxAge=12*3600000
   const light=await new Promise((resolve,reject)=>Auth.serializeUser(user,(e,v)=>e?reject(e):resolve(v)))
   const session={cookie:{originalMaxAge:maxAge,expires:new Date(Date.now()+maxAge).toISOString(),secure:true,httpOnly:true,path:'/',sameSite:'lax'},passport:{user:light},analyticsId:String(user.analyticsId||user._id),validationToken:'v1:'+sid.slice(-4)}
   await redis.set('sess:'+sid,JSON.stringify(session),'PX',maxAge);await UserSessions.promises.trackSession(user,sid)
   const sig=crypto.createHmac('sha256',Settings.security.sessionSecret).update(sid).digest('base64').replace(/=+$/,'')
   result={cookie:Settings.cookieName+'='+encodeURIComponent('s:'+sid+'.'+sig),overleafId:String(user._id)}
  }else if(req.url==='/projects'){
   const projects=await Project.find({...(input.includeTrashed?{}:{trashed:{$ne:user._id}}),$or:[{owner_ref:user._id},{collaberator_refs:user._id},{readOnly_refs:user._id}]}).select('_id name lastUpdated owner_ref compiler').sort({lastUpdated:-1}).limit(200).lean().exec()
   result={projects:projects.map(p=>({id:String(p._id),name:p.name,updated_at:p.lastUpdated,compiler:p.compiler,role:String(p.owner_ref)===String(user._id)?'owner':'collaborator'}))}
  }else if(req.url==='/trash'){
   if(!/^[a-f0-9]{24}$/.test(input.project||'')){res.writeHead(404);return res.end('{}')}
   const project=await Project.findOne({_id:input.project,owner_ref:user._id}).select('_id').lean().exec()
   if(!project){res.writeHead(404);return res.end('{}')}
   await Deleter.promises.trashProject(project._id,user._id)
   result={ok:true}
  }else if(req.url==='/import'){
   if(!/^[a-f0-9-]{36}$/.test(input.upload))throw Error('Invalid upload')
   const file='/cbgpu/imports/'+input.upload+'.zip'
   const {project}=await Upload.promises.createProjectFromZipArchiveWithName(user._id,String(input.name||'Untitled').slice(0,120),file)
   try{
    if(input.main)await RootDoc.promises.setRootDocFromName(project._id,input.main)
    await Project.updateOne({_id:project._id},{$set:{compiler:['pdflatex','xelatex','lualatex','latex'].includes(input.compiler)?input.compiler:'pdflatex',publicAccesLevel:'private'}})
   }finally{await fs.unlink(file).catch(()=>{})}
   result={id:String(project._id),name:project.name}
  }else throw Error('Not found')
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result))
 }catch(e){console.error('CBGPU bridge operation failed:',e.stack||e.message);res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:'LaTeX operation failed'}))}
}).listen(3523,'0.0.0.0')
