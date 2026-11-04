#!/usr/bin/env python3
"""Idempotent stack setup. Existing secrets, project volumes and other services are preserved."""
import os,secrets,subprocess,time
from pathlib import Path
HERE=Path(__file__).resolve().parent;REPO=HERE.parents[1];PRIVATE=HERE.parent/'private/latex'
def run(*args):return subprocess.run(args,check=True,stdout=subprocess.DEVNULL)
def compose(*args):return run('docker','compose','-f',str(HERE/'compose.yml'),*args)
def main():
 os.umask(0o077);PRIVATE.mkdir(parents=True,exist_ok=True,mode=0o700)
 for name in ('run','imports','jobs','overleaf','mongo','redis'):(PRIVATE/name).mkdir(exist_ok=True)
 for name,value in [('bridge-key',secrets.token_hex(32)),('compiler-image','texlive/texlive@sha256:540d736c78e2803cdd7b6a196bd21339c30185948db55e04e75a415959102ca8')]:
  file=PRIVATE/name
  if not file.exists():file.write_text(value+'\n');file.chmod(0o600)
 env=PRIVATE/'overleaf.env'
 if not env.exists():
  env.write_text('\n'.join(['OVERLEAF_APP_NAME=CBGPU LaTeX','OVERLEAF_NAV_TITLE=CBGPU LaTeX','OVERLEAF_SITE_URL=https://latex.cbgpu.com','OVERLEAF_MONGO_URL=mongodb://mongo:27017/sharelatex?replicaSet=cbgpu-latex','OVERLEAF_REDIS_HOST=redis','OVERLEAF_SESSION_SECRET='+secrets.token_hex(64),'OVERLEAF_INVITE_TOKEN_SECRET='+secrets.token_urlsafe(32),'OVERLEAF_ADMIN_EMAIL=just_grassy@cbgpu.com','OVERLEAF_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING=false','OVERLEAF_RESTRICT_INVITES_TO_EXISTING_ACCOUNTS=true','OVERLEAF_SECURE_COOKIE=true','COMPILE_TIMEOUT=300'])+'\n');env.chmod(0o600)
 unit=Path.home()/'.config/systemd/user';unit.mkdir(parents=True,exist_ok=True)
 for source in (HERE/'systemd').iterdir():(unit/source.name).write_text(source.read_text().replace('@REPOSITORY@',str(REPO)))
 compose('up','-d','mongo','redis')
 command=['docker','exec','cbgpu-latex-mongo','mongosh','--quiet','--eval','try {rs.status().ok} catch(e) {rs.initiate({_id:"cbgpu-latex",members:[{_id:0,host:"mongo:27017"}]})}']
 for attempt in range(30):
  if subprocess.run(command,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
  time.sleep(1)
 else:raise RuntimeError('Mongo did not become ready')
 compose('up','-d','overleaf')
 # The broker alone receives an inherited ACL; the parent private directory stays mode 700.
 compiles=PRIVATE/'overleaf/data/compiles'
 for attempt in range(60):
  if compiles.exists():break
  time.sleep(1)
 else:raise RuntimeError('CE compile directory missing')
 uid=os.getuid()
 script=f'import ctypes; a=ctypes.CDLL("libacl.so.1",use_errno=True);a.acl_from_text.restype=ctypes.c_void_p;a.acl_set_file.argtypes=[ctypes.c_char_p,ctypes.c_int,ctypes.c_void_p];p=a.acl_from_text(b"u::rwx,u:{uid}:rwx,g::r-x,m::rwx,o::r-x");assert a.acl_set_file(b"/compiles",0x8000,p)==0;assert a.acl_set_file(b"/compiles",0x4000,p)==0'
 run('docker','run','--rm','--network','none','--mount',f'type=bind,src={compiles},dst=/compiles','--entrypoint','python','python:3.12-slim','-c',script)
 run('systemctl','--user','daemon-reload');run('systemctl','--user','enable','--now','cbgpu-latex-compiler.service','cbgpu-latex-gateway.service','cbgpu-latex-backup.timer')
 print('CBGPU LaTeX stack installed; verify locally before publishing a tunnel route.')
if __name__=='__main__':main()
