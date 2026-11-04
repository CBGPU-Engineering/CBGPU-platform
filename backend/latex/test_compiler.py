#!/usr/bin/env python3
"""Exercise the real sandbox against TeX startup-script execution, symlinks and timeouts."""
import asyncio,json,shutil,tempfile,uuid
from pathlib import Path
from aiohttp import ClientSession,UnixConnector
ROOT=Path(__file__).resolve().parents[1]/'private/latex'
async def main():
 folders=[]
 async with ClientSession(connector=UnixConnector(path=str(ROOT/'run/compile.sock'))) as http:
  async def compile(files,timeout=30000):
   name=uuid.uuid4().hex+'-'+uuid.uuid4().hex;folder=ROOT/'overleaf/data/compiles'/name;folder.mkdir();folders.append(folder)
   for file,content in files.items():(folder/file).write_text(content)
   body={'id':str(uuid.uuid4()),'directory':'/var/lib/overleaf/data/compiles/'+name,'command':['latexmk','-pdf','-jobname=output','-outdir=$COMPILE_DIR','$COMPILE_DIR/main.tex'],'timeout':timeout}
   async with http.post('http://unix/run',json=body) as response:
    result=await response.json();assert response.status==200,result
   return folder,result
  folder,result=await compile({'main.tex':r'\documentclass{article}\begin{document}Sandbox PDF\end{document}'})
  assert result['exitCode']==0,result;assert (folder/'output.pdf').read_bytes().startswith(b'%PDF-');print('PASS real PDF through tmpfs sandbox')
  startup=r'''open(my $f, '>', 'output.probe');print $f ((exists $ENV{'SUPABASE_SERVICE_ROLE_KEY'} || -e '/var/run/docker.sock' || -e '/var/lib/overleaf/data') ? 'LEAK' : 'ISOLATED');close($f);system('ln -s /etc/passwd output.pdf');exit(0);'''
  folder,result=await compile({'main.tex':'ignored','.latexmkrc':startup})
  assert (folder/'output.probe').read_text()=='ISOLATED';assert not (folder/'output.pdf').exists();print('PASS untrusted latexmk code has no host credentials, Docker socket or CE files; symlink output not published')
  folder,result=await compile({'main.tex':'ignored','.latexmkrc':'sleep 30; exit(0);'},1500)
  assert result.get('terminated') and result['exitCode']==124,result;print('PASS compile timeout kills isolated job')
  async with http.post('http://unix/run',json={'id':str(uuid.uuid4()),'directory':'/etc','command':['latexmk']}) as response:assert response.status==400
  print('PASS host-path compile request rejected')
 for folder in folders:shutil.rmtree(folder)
if __name__=='__main__':asyncio.run(main())
