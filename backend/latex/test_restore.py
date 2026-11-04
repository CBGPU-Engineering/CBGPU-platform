#!/usr/bin/env python3
"""Restore the latest Mongo backup to an isolated temporary instance, without touching live data."""
import json,subprocess,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'private/latex';backups=sorted(p for p in (ROOT/'backups').iterdir() if p.is_dir() and not p.name.endswith('.partial'));latest=backups[-1]
name='cbgpu-latex-restore-test-'+uuid.uuid4().hex[:10]
image=json.loads(subprocess.check_output(['docker','image','inspect','mongo:8.0.34']))[0]['RepoDigests'][0]
def run(*args,**kwargs):return subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,**kwargs)
try:
 result=run('docker','run','-d','--name',name,'--network','none','--memory','2g','-e','GLIBC_TUNABLES=glibc.pthread.rseq=1','--tmpfs','/data/db:size=1g','--tmpfs','/data/configdb:size=64m',image,'mongod','--bind_ip','127.0.0.1','--wiredTigerCacheSizeGB','0.25');assert result.returncode==0
 for attempt in range(30):
  result=run('docker','exec',name,'mongosh','--quiet','--eval','db.adminCommand({ping:1}).ok')
  if result.returncode==0:break
  time.sleep(.5)
 else:raise RuntimeError('Temporary restore database did not become ready')
 with (latest/'mongo.archive.gz').open('rb') as source:result=run('docker','exec','-i',name,'mongorestore','--archive','--gzip','--oplogReplay',stdin=source,timeout=60)
 assert result.returncode==0,'Mongo restore failed'
 result=run('docker','exec',name,'mongosh','--quiet','sharelatex','--eval','db.getCollectionNames().length');assert int(result.stdout.strip())>10
 print('PASS private Mongo archive and oplog restored into a disconnected temporary instance; live database untouched')
finally:run('docker','rm','-f',name)
