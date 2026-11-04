// CBGPU's independent compile adapter for Overleaf CE (AGPL-3.0).
// No Docker socket, credentials, or host filesystem is available to TeX.
import http from 'node:http'
import {randomUUID} from 'node:crypto'
import {promisify} from 'node:util'
const jobs=new Map()
function call(path,body,callback){
 const request=http.request({socketPath:'/cbgpu/run/compile.sock',path,method:'POST',headers:{'content-type':'application/json'}},res=>{
  let out='';res.on('data',c=>{out+=c;if(out.length>5000000)request.destroy()});res.on('end',()=>{try{const result=JSON.parse(out);if(res.statusCode!==200)throw Error(result.error||'Compile service failed');callback(null,result)}catch(e){callback(e)}})
 });request.on('error',callback);request.end(JSON.stringify(body));return request
}
const runner={
 run(projectId,command,directory,image,timeout,environment,compileGroup,cwd,callback){
  const id=randomUUID();let done=false
  jobs.set(id,call('/run',{id,projectId,command,directory,timeout,cwd,environment},(err,result)=>{
   if(done)return;done=true;jobs.delete(id)
   if(result?.terminated){err=Error('terminated');err.terminated=true;err.timedout=!!result.timedout}
   callback(err,result)
  }));return id
 },
 kill(id,cb=()=>{}){call('/kill',{id},err=>cb(err))},
 canRunSyncTeXInOutputDir(){return true},
}
runner.promises={run:promisify(runner.run),kill:promisify(runner.kill)}
export default runner
