#!/usr/bin/env python3
"""Disposable TeX sandboxes: no network/secrets/Docker socket; 512 MB writable tmpfs per job."""
import asyncio,os,re,shutil,stat,tarfile,tempfile,uuid
from pathlib import Path
from aiohttp import web
ROOT=Path(__file__).resolve().parents[1]/'private/latex';COMPILES=ROOT/'overleaf/data/compiles'
IMAGE='';jobs={};semaphore=asyncio.Semaphore(3)
async def docker(*args):
 p=await asyncio.create_subprocess_exec('/usr/bin/docker',*args,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
 out,err=await p.communicate();return p.returncode,out,err
async def capture(stream,limit=2000000):
 result=bytearray();total=0
 while True:
  data=await stream.read(65536)
  if not data:break
  total+=len(data)
  if total>8000000:raise ValueError('Compiler output exceeded 8 MB')
  result.extend(data)
  if len(result)>limit:del result[:-limit]
 return bytes(result)
def snapshot(directory,stage):
 total=0;count=0
 for path in directory.rglob('*'):
  if path.is_symlink():raise ValueError('Symbolic compile input refused')
  if path.is_file():
   count+=1;total+=path.stat().st_size
   if total>400*1024**2 or count>5000:raise ValueError('Project compile cache exceeds limits; clear cached files in the editor')
   dest=stage/path.relative_to(directory);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(path,dest)
def publish(archive,directory):
 total=0
 with tarfile.open(archive) as tar:
  for member in tar:
   if not member.isreg() or '/' in member.name or not member.name.startswith('output.'):continue
   total+=member.size
   if total>300*1024**2:raise ValueError('Compile output exceeds 300 MB')
   fd,tmp=tempfile.mkstemp(prefix='.cbgpu-',dir=directory)
   try:
    with os.fdopen(fd,'wb') as out,tar.extractfile(member) as inp:shutil.copyfileobj(inp,out)
    os.chmod(tmp,0o666);os.replace(tmp,directory/member.name)
   finally:Path(tmp).unlink(missing_ok=True)
async def collect(name,directory,stage):
 script="import os,tarfile,stat,sys; t=tarfile.open(fileobj=sys.stdout.buffer,mode='w|'); [(t.add('/compile/'+n,arcname=n,recursive=False)) for n in os.listdir('/compile') if n.startswith('output.') and stat.S_ISREG(os.lstat('/compile/'+n).st_mode)]; t.close()"
 process=await asyncio.create_subprocess_exec('/usr/bin/docker','exec',name,'python3','-c',script,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.DEVNULL)
 archive=stage/'result.tar';total=0
 try:
  with archive.open('wb') as out:
   while True:
    chunk=await asyncio.wait_for(process.stdout.read(65536),10)
    if not chunk:break
    total+=len(chunk)
    if total>320*1024**2:raise ValueError('Output archive too large')
    out.write(chunk)
  await process.wait()
  if process.returncode!=0:raise ValueError('Unable to collect compile output')
  await asyncio.to_thread(publish,archive,directory)
 finally:
  if process.returncode is None:process.kill();await process.wait()
async def run(req):
 data=await req.json();ident=str(uuid.UUID(data['id']));name='cbgpu-latex-job-'+ident
 raw=str(data['directory']);prefix='/var/lib/overleaf/data/compiles/'
 if not raw.startswith(prefix):raise web.HTTPBadRequest(text='Invalid compile directory')
 relative=raw[len(prefix):]
 if '/' in relative or not re.fullmatch(r'[a-zA-Z0-9_-]{20,180}',relative):raise web.HTTPBadRequest(text='Invalid project')
 directory=COMPILES/relative
 if not directory.is_dir() or directory.is_symlink() or directory.resolve().parent!=COMPILES.resolve():raise web.HTTPBadRequest(text='Invalid compile directory')
 command=data.get('command');cwd=data.get('cwd')
 if not isinstance(command,list) or not command or len(command)>80 or any(not isinstance(x,(str,int,float)) or len(str(x))>8192 for x in command):raise web.HTTPBadRequest()
 executable=Path(str(command[0])).name
 if executable not in {'latexmk','synctex','texcount','pdflatex','xelatex','lualatex','latex','bibtex','biber','convert','inkscape','epstopdf','gs','rsvg-convert','makeindex'}:raise web.HTTPBadRequest(text='Unsupported compile command')
 command=[str(x).replace('$COMPILE_DIR',raw).replace(raw,'/compile') for x in command];command[0]=executable
 work='/compile'
 if cwd:
  work='/compile/'+str(cwd)
  if not (directory/str(cwd)).resolve().is_relative_to(directory.resolve()):raise web.HTTPBadRequest()
 timeout=min(300,max(1,float(data.get('timeout',300000))/1000))
 async with semaphore:
  stage=Path(tempfile.mkdtemp(prefix='job-',dir=ROOT/'jobs'));jobs[ident]=name
  try:
   await asyncio.to_thread(snapshot,directory,stage);uid,gid=os.getuid(),os.getgid()
   args=['run','-d','--name',name,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','128','--cpus','2','--memory','2g','--memory-swap','2g','--ulimit','fsize=268435456:268435456','--user',f'{uid}:{gid}','--tmpfs','/tmp:rw,nosuid,nodev,size=256m,mode=1777','--tmpfs',f'/compile:rw,nosuid,nodev,size=512m,uid={uid},gid={gid},mode=0700','--mount',f'type=bind,src={stage},dst=/source,readonly','--workdir','/compile','-e','HOME=/tmp','-e','TEXMFVAR=/tmp/texmf-var','-e','TEXMFCONFIG=/tmp/texmf-config','-e','openin_any=p','-e','openout_any=p',IMAGE,'sleep','330']
   code,out,err=await docker(*args)
   if code:raise ValueError('Unable to start sandbox: '+err.decode(errors='replace')[-500:])
   process=await asyncio.create_subprocess_exec('/usr/bin/docker','exec','--workdir',work,name,'sh','-c','cp -R /source/. /compile/ && exec "$@"','cbgpu',*command,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
   async def output():
    stdout,stderr=await asyncio.gather(capture(process.stdout),capture(process.stderr));await process.wait();return stdout,stderr
   try:
    stdout,stderr=await asyncio.wait_for(output(),timeout)
    await collect(name,directory,stage)
    return web.json_response({'stdout':stdout.decode(errors='replace'),'stderr':stderr.decode(errors='replace'),'exitCode':process.returncode})
   except (asyncio.TimeoutError,ValueError) as e:
    await docker('rm','-f',name);await process.wait()
    return web.json_response({'stdout':'','stderr':'CBGPU: compilation stopped: '+str(e or 'compile timeout'),'exitCode':124,'terminated':True,'timedout':isinstance(e,asyncio.TimeoutError)})
  except Exception as e:return web.json_response({'error':'Compile sandbox: '+str(e)},status=400)
  finally:
   jobs.pop(ident,None);await docker('rm','-f',name);await asyncio.to_thread(shutil.rmtree,stage,True)
async def kill(req):
 ident=str(uuid.UUID((await req.json())['id']));name=jobs.get(ident)
 if name:await docker('rm','-f',name)
 return web.json_response({'ok':True})
async def main():
 global IMAGE
 IMAGE=(ROOT/'compiler-image').read_text().strip();(ROOT/'jobs').mkdir(exist_ok=True)
 socket=ROOT/'run/compile.sock';socket.unlink(missing_ok=True)
 app=web.Application(client_max_size=65536);app.router.add_post('/run',run);app.router.add_post('/kill',kill)
 runner=web.AppRunner(app,access_log=None);await runner.setup();await web.UnixSite(runner,str(socket)).start();os.chmod(socket,0o666)
 await asyncio.Event().wait()
if __name__=='__main__':asyncio.run(main())
