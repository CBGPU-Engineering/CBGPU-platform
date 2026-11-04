#!/usr/bin/env python3
"""Private Overleaf data backups, separate from the size-limited main website archive."""
import datetime,os,shutil,sqlite3,subprocess,tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'private/latex';BACKUPS=ROOT/'backups'
os.umask(0o077);BACKUPS.mkdir(exist_ok=True)
if shutil.disk_usage(ROOT).free<20*1024**3:raise RuntimeError('Not enough free disk space for LaTeX backup')
folder=BACKUPS/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.partial');folder.mkdir()
try:
 for name,command in [('mongo.archive.gz',['docker','exec','cbgpu-latex-mongo','mongodump','--archive','--gzip','--oplog']),('files.tar.gz',['docker','exec','cbgpu-latex-overleaf','tar','--exclude=data/compiles','--exclude=data/cache','-czf','-','-C','/var/lib/overleaf','data']),('redis.rdb',['docker','exec','cbgpu-latex-redis','sh','-c','redis-cli SAVE >/dev/null && cat /data/dump.rdb'])]:
  with (folder/name).open('wb') as output:subprocess.run(command,stdout=output,stderr=subprocess.DEVNULL,check=True,timeout=600)
  if (folder/name).stat().st_size==0:raise RuntimeError('Empty backup: '+name)
 with tarfile.open(folder/'files.tar.gz') as archive:archive.getmembers()
 for name in ('bridge-key','overleaf.env','compiler-image'):shutil.copyfile(ROOT/name,folder/name)
 with sqlite3.connect(ROOT/'gateway.sqlite') as source,sqlite3.connect(folder/'gateway.sqlite') as target:source.backup(target)
 (folder/'RESTORE.txt').write_text('Restore with CE stopped. Keep secrets unchanged. mongorestore --archive=mongo.archive.gz --gzip --oplogReplay to a separate fresh replica set; restore files.tar.gz under /var/lib/overleaf; restore Redis RDB before starting Redis. Restore gateway.sqlite only for identity/session continuity; native CBGPU sessions are always revalidated. Keep this backup private.\n')
 complete=folder.with_suffix('');folder.rename(complete)
 for old in sorted([p for p in BACKUPS.iterdir() if p.is_dir() and not p.name.endswith('.partial')],reverse=True)[7:]:shutil.rmtree(old)
 print('LaTeX backup completed:',complete.name)
except Exception:
 shutil.rmtree(folder,ignore_errors=True);raise
