#!/usr/bin/env python3
"""Authenticated gateway for the real Overleaf CE editor, files and realtime channels."""
import asyncio,base64,hashlib,hmac,io,json,os,re,secrets,sqlite3,time,uuid,zipfile
from pathlib import Path
from urllib.parse import urlencode,unquote
from aiohttp import web,ClientSession,ClientTimeout,WSMsgType
from zip_import import inspect_zip,ImportError
ROOT=Path(__file__).resolve().parents[1];PRIVATE=ROOT/'private/latex';KEY=(PRIVATE/'bridge-key').read_text().strip()
db=sqlite3.connect(PRIVATE/'gateway.sqlite');db.row_factory=sqlite3.Row;os.chmod(PRIVATE/'gateway.sqlite',0o600)
db.executescript('''CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,proof TEXT,expires REAL);CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT,native_session TEXT,ce_cookie TEXT,expires REAL);CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY,session_id TEXT,proof TEXT,target TEXT,expires REAL);CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY,user_id TEXT,metadata TEXT,expires REAL);''')
if 'result' not in [row[1] for row in db.execute('PRAGMA table_info(uploads)')]:db.execute('ALTER TABLE uploads ADD COLUMN result TEXT');db.commit()
db.execute('CREATE TABLE IF NOT EXISTS incoming(id TEXT PRIMARY KEY,user_id TEXT,name TEXT,size INTEGER,received INTEGER,expires REAL)');db.commit()
cache={};http=None;upload_locks={}
PUBLIC='https://latex.cbgpu.com';PORTAL='https://researcher.cbgpu.com/latex'
async def active(user,sid):
 if not re.fullmatch(r'[a-f0-9-]{36}',user) or not re.fullmatch(r'[a-f0-9-]{36}',sid):return False
 key=(user,sid)
 if cache.get(key,0)>time.time():return True
 sql=f"SELECT EXISTS(SELECT 1 FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id JOIN public.profiles p ON p.id=u.id WHERE s.id='{sid}'::uuid AND s.user_id='{user}'::uuid AND (s.not_after IS NULL OR s.not_after>now()) AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now()) AND coalesce(p.is_approved,true))"
 proc=await asyncio.create_subprocess_exec('/usr/bin/docker','exec','cbgpu-supabase-db','psql','-U','supabase_admin','-d','postgres','-At','-c',sql,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.DEVNULL)
 try:out,_=await asyncio.wait_for(proc.communicate(),5)
 except asyncio.TimeoutError:proc.kill();await proc.wait();return False
 valid=proc.returncode==0 and out.strip()==b't'
 if valid:cache[key]=time.time()+10
 return valid
async def bridge(path,body):
 async with http.post('http://127.0.0.1:3523/'+path,json=body,headers={'Authorization':'Bearer '+KEY},timeout=ClientTimeout(total=180)) as response:
  if response.status==404:raise web.HTTPNotFound()
  if response.status!=200:raise web.HTTPBadGateway(text='논문 편집 서비스가 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  return await response.json()
def answer(data,status=200):return web.json_response(data,status=status,headers={'Cache-Control':'no-store'})
async def identity(req):
 if req.headers.get('X-CBGPU-Key')!=KEY:raise web.HTTPForbidden()
 try:user=json.loads(base64.b64decode(req.headers['X-CBGPU-Identity']))
 except Exception:raise web.HTTPUnauthorized()
 if not await active(user.get('id',''),user.get('session','')):raise web.HTTPUnauthorized()
 return user
async def finish_upload(user,ident,path,name):
 normalized=PRIVATE/'imports'/(ident+'.normalized')
 try:
  info=await asyncio.to_thread(inspect_zip,path,normalized)
  info.pop('zip',None);info['name']=Path(name or 'Untitled.zip').stem[:100]
  normalized.replace(PRIVATE/'imports'/(ident+'.zip'))
  db.execute('INSERT INTO uploads(id,user_id,metadata,expires) VALUES(?,?,?,?)',(ident,user['id'],json.dumps(info),time.time()+1800));db.commit()
  return answer({'upload':ident,**info})
 except ImportError as e:return answer({'error':str(e)},422)
 finally:normalized.unlink(missing_ok=True);path.unlink(missing_ok=True)
def incoming_row(user,ident):
 if not re.fullmatch(r'[a-f0-9-]{36}',str(ident)):raise web.HTTPBadRequest()
 row=db.execute('SELECT * FROM incoming WHERE id=? AND user_id=? AND expires>?',(ident,user['id'],time.time())).fetchone()
 if not row:raise web.HTTPNotFound()
 return row
async def api(req):
 user=await identity(req);action=req.match_info['action']
 if action=='projects' and req.method=='GET':return answer(await bridge('projects',{'user':user}))
 if req.method!='POST':raise web.HTTPMethodNotAllowed(req.method,['POST'])
 if action=='upload-begin':
  data=await req.json();size=data.get('size');name=str(data.get('name',''))
  if type(size) is not int or size<=0 or size>9007199254740991 or not name.lower().endswith('.zip'):return answer({'error':'올바른 ZIP 파일을 선택해 주세요.'},400)
  count=db.execute('SELECT count(*) FROM incoming WHERE user_id=? AND expires>?',(user['id'],time.time())).fetchone()[0]
  count+=db.execute('SELECT count(*) FROM uploads WHERE user_id=? AND expires>? AND result IS NULL',(user['id'],time.time())).fetchone()[0]
  if count>=5:return answer({'error':'가져오기 대기 중인 ZIP이 많습니다. 먼저 기존 가져오기를 완료해 주세요.'},429)
  ident=str(uuid.uuid4());(PRIVATE/'imports'/(ident+'.partial')).touch(mode=0o600,exist_ok=False)
  db.execute('INSERT INTO incoming VALUES(?,?,?,?,?,?)',(ident,user['id'],name[:255],size,0,time.time()+86400));db.commit()
  return answer({'upload':ident,'offset':0})
 if action=='upload-chunk':
  header=await req.content.readline()
  if len(header)>1024:raise web.HTTPBadRequest()
  try:data=json.loads(header);ident=data['upload'];offset=data['offset']
  except (ValueError,KeyError,TypeError):raise web.HTTPBadRequest()
  incoming_row(user,ident)
  lock=upload_locks.setdefault(ident,asyncio.Lock())
  async with lock:
   row=incoming_row(user,ident);path=PRIVATE/'imports'/(ident+'.partial')
   if type(offset) is not int or offset!=row['received'] or path.stat().st_size!=offset:return answer({'error':'업로드 위치가 맞지 않습니다. ZIP을 다시 선택해 주세요.'},409)
   chunk=await req.content.read(8*1024**2+1)
   # read() may return a short segment; consume the complete bounded chunk.
   while not req.content.at_eof() and len(chunk)<=8*1024**2:chunk+=await req.content.read(8*1024**2+1-len(chunk))
   if not chunk or len(chunk)>8*1024**2 or offset+len(chunk)>row['size']:return answer({'error':'올바르지 않은 전송 조각입니다.'},400)
   try:
    with path.open('ab') as dest:dest.write(chunk)
    db.execute('UPDATE incoming SET received=?,expires=? WHERE id=?',(offset+len(chunk),time.time()+86400,ident));db.commit()
   except Exception:
    with path.open('r+b') as dest:dest.truncate(offset)
    raise
   return answer({'offset':offset+len(chunk)})
 if action in ('upload-finish','upload-cancel'):
  data=await req.json();ident=data.get('upload');incoming_row(user,ident)
  async with upload_locks.setdefault(ident,asyncio.Lock()):
   row=incoming_row(user,ident);path=PRIVATE/'imports'/(ident+'.partial')
   if action=='upload-cancel':
    path.unlink(missing_ok=True);db.execute('DELETE FROM incoming WHERE id=?',(ident,));db.commit();return answer({'ok':True})
   if row['received']!=row['size'] or path.stat().st_size!=row['size']:return answer({'error':'ZIP 업로드가 완료되지 않았습니다.'},409)
   try:return await finish_upload(user,ident,path,row['name'])
   finally:db.execute('DELETE FROM incoming WHERE id=?',(ident,));db.commit()
 if action=='inspect':
  count=db.execute('SELECT count(*) FROM uploads WHERE user_id=? AND expires>? AND result IS NULL',(user['id'],time.time())).fetchone()[0]
  if count>=5:return answer({'error':'가져오기 대기 중인 ZIP이 많습니다. 먼저 기존 가져오기를 완료해 주세요.'},429)
  reader=await req.multipart();part=await reader.next()
  if not part or part.name!='file':return answer({'error':'ZIP 파일을 선택해 주세요.'},400)
  ident=str(uuid.uuid4());path=PRIVATE/'imports'/(ident+'.partial')
  try:
   with path.open('xb') as dest:
    while True:
     chunk=await part.read_chunk(1024*1024)
     if not chunk:break
     dest.write(chunk)
   return await finish_upload(user,ident,path,part.filename)
  finally:path.unlink(missing_ok=True)
 data=await req.json()
 if action=='trash':
  project=str(data.get('project',''))
  if not re.fullmatch(r'[a-f0-9]{24}',project):return answer({'error':'Project not found'},404)
  return answer(await bridge('trash',{'user':user,'project':project}))
 if action=='new':
  ident=str(uuid.uuid4());buffer=io.BytesIO()
  with zipfile.ZipFile(buffer,'w') as archive:archive.writestr('main.tex',r'\documentclass{article}'+'\n'+r'\begin{document}'+'\n\n'+r'\end{document}'+'\n')
  (PRIVATE/'imports'/f'{ident}.zip').write_bytes(buffer.getvalue())
  try:result=await bridge('import',{'user':user,'upload':ident,'main':'main.tex','compiler':'pdflatex','name':'Untitled project'})
  finally:(PRIVATE/'imports'/f'{ident}.zip').unlink(missing_ok=True)
  return answer(result,201)
 if action=='import':
  upload=str(data.get('upload',''));lock=upload_locks.setdefault(upload,asyncio.Lock())
  async with lock:
   upload=str(data.get('upload',''));row=db.execute('SELECT * FROM uploads WHERE id=? AND user_id=? AND expires>?',(upload,user['id'],time.time())).fetchone()
   if not row:return answer({'error':'가져오기 정보가 만료되었습니다. ZIP을 다시 올려 주세요.'},410)
   if row['result']:return answer(json.loads(row['result']),201)
   info=json.loads(row['metadata']);main=data.get('main')
   if main not in info['files'] or not main.lower().endswith('.tex'):return answer({'error':'메인 TeX 파일을 선택해 주세요.'},400)
   compiler=data.get('compiler','pdflatex')
   if compiler not in ('pdflatex','xelatex','lualatex','latex'):return answer({'error':'지원하지 않는 컴파일러입니다.'},400)
   result=await bridge('import',{'user':user,'upload':upload,'main':main,'compiler':compiler,'name':str(data.get('name') or info['name'])[:120]})
   db.execute('UPDATE uploads SET result=?,expires=? WHERE id=?',(json.dumps(result),time.time()+300,upload));db.commit();return answer(result,201)
 if action=='open':
  target=str(data.get('project',''))
  if target:
   if not re.fullmatch(r'[a-f0-9]{24}',target):raise web.HTTPBadRequest()
   projects=(await bridge('projects',{'user':user}))['projects']
   if not any(p['id']==target for p in projects):raise web.HTTPNotFound()
  challenge=str(data.get('challenge',''));challenge_row=db.execute('SELECT * FROM challenges WHERE id=? AND expires>?',(challenge,time.time())).fetchone()
  if not challenge_row:return answer({'error':'편집기 연결을 다시 시작해 주세요.'},410)
  db.execute('DELETE FROM challenges WHERE id=?',(challenge,));db.commit()
  ce=await bridge('session',{'user':user});sid=secrets.token_urlsafe(32);ticket=secrets.token_urlsafe(32);proof_hash=challenge_row['proof']
  db.execute('INSERT INTO sessions VALUES(?,?,?,?,?)',(sid,user['id'],user['session'],ce['cookie'],time.time()+43200))
  db.execute('INSERT INTO tickets VALUES(?,?,?,?,?)',(hashlib.sha256(ticket.encode()).hexdigest(),sid,proof_hash,'/project/'+target if target else '/project',time.time()+60));db.commit()
  return answer({'url':PUBLIC+'/cbgpu/enter?'+urlencode({'ticket':ticket})})
 return answer({'error':'Not found'},404)
async def connect(req):
 project=req.query.get('project','')
 if project and not re.fullmatch(r'[a-f0-9]{24}',project):raise web.HTTPBadRequest()
 proof=secrets.token_urlsafe(32);challenge=secrets.token_urlsafe(32)
 db.execute('INSERT INTO challenges VALUES(?,?,?)',(challenge,hashlib.sha256(proof.encode()).hexdigest(),time.time()+300));db.commit()
 target='https://app.cbgpu.com/latex' if req.query.get('portal')=='app' else PORTAL
 response=web.HTTPSeeOther(target+'?'+urlencode({'connect':challenge,'project':project,'mode':'researcher'}))
 response.set_cookie('__Host-cbgpu-latex-proof',proof,secure=True,httponly=True,samesite='Lax',max_age=300,path='/')
 return response
async def enter(req):
 ticket=hashlib.sha256(req.query.get('ticket','').encode()).hexdigest();row=db.execute('SELECT * FROM tickets WHERE id=?',(ticket,)).fetchone()
 proof=hashlib.sha256(req.cookies.get('__Host-cbgpu-latex-proof','').encode()).hexdigest()
 if not row or row['expires']<time.time() or not hmac.compare_digest(proof,row['proof']):return web.Response(text='연결이 만료되었거나 다른 브라우저입니다. researcher.cbgpu.com/latex에서 편집기를 다시 열어 주세요.',status=401)
 session=db.execute('SELECT * FROM sessions WHERE id=?',(row['session_id'],)).fetchone()
 if not session or not await active(session['user_id'],session['native_session']):raise web.HTTPUnauthorized()
 db.execute('DELETE FROM tickets WHERE id=?',(ticket,));db.commit()
 res=web.HTTPSeeOther(row['target']);res.set_cookie('__Host-cbgpu-latex',session['id'],secure=True,httponly=True,samesite='Lax',max_age=43200,path='/')
 return res
async def session_for(req):
 row=db.execute('SELECT * FROM sessions WHERE id=? AND expires>?',(req.cookies.get('__Host-cbgpu-latex',''),time.time())).fetchone()
 if row and await active(row['user_id'],row['native_session']):return row
 return None
HOP={'connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade','content-length','content-encoding','set-cookie'}
async def proxy(req):
 # nginx normalizes paths before matching its direct compile-output locations.
 # Refuse ambiguous paths so normalization can never skip project ownership checks.
 decoded=unquote(req.rel_url.raw_path)
 for _ in range(2):
  if unquote(decoded)==decoded:break
  decoded=unquote(decoded)
 if '\\' in decoded or '\x00' in decoded or '//' in decoded or any(segment in ('.','..') for segment in decoded.split('/')):raise web.HTTPBadRequest(text='Invalid resource path')
 if req.path=='/healthz':return answer({'status':'ok','service':'cbgpu-latex'})
 if req.path=='/cbgpu/logo.png':return web.FileResponse(ROOT.parent/'FrontEnd/cbgpu/public/img/cbgpu-logo.png')
 if req.path=='/cbgpu/editor.js':return web.FileResponse(Path(__file__).parent/'editor.js',headers={'Cache-Control':'no-cache'})
 if req.path=='/cbgpu/editor.css':return web.FileResponse(Path(__file__).parent/'editor.css',headers={'Cache-Control':'no-cache'})
 if req.path in ('/cbgpu/source','/cbgpu/source.zip'):
  buffer=io.BytesIO()
  with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as archive:
   for source in [*Path(__file__).parent.iterdir(),*(Path(__file__).parent/'systemd').iterdir()]:
    if source.is_file() and source.suffix in ('.py','.mjs','.js','.sh','.css','.yml','.txt','.md','.service','.timer') or source.name in ('LICENSE','bridge-run'):
     if source.is_file():archive.write(source,'cbgpu-latex/'+str(source.relative_to(Path(__file__).parent)))
  return web.Response(body=buffer.getvalue(),headers={'Content-Type':'application/zip','Content-Disposition':'attachment; filename="cbgpu-latex-source.zip"'})

 session=await session_for(req)
 if not session:
  if req.method=='GET' and req.headers.get('Upgrade','').lower()!='websocket':raise web.HTTPSeeOther(PORTAL)
  return answer({'error':'CBGPU 로그인이 만료되었습니다. 논문 작성 화면에서 다시 열어 주세요.'},401)
 if req.path in ('/login','/register','/user/password/reset','/user/password/set','/launchpad') or req.path.startswith(('/admin','/user/email','/user/password','/user/delete')):raise web.HTTPSeeOther(PORTAL)
 if req.method not in ('GET','HEAD','OPTIONS') and req.headers.get('Origin')!=PUBLIC:return answer({'error':'Invalid origin'},403)
 # Native uploads use the same validator; project ZIP imports go through the CBGPU import wizard.
 if req.path=='/project/new/upload':return answer({'error':'ZIP은 CBGPU 논문 작성 화면의 ZIP 가져오기를 이용해 주세요.'},422)
 project_match=re.match(r'^/project/([a-f0-9]{24})(?:/|$)',req.path,re.IGNORECASE)
 if project_match:
  trash_action=req.method=='DELETE' and bool(re.fullmatch(r'/project/[a-f0-9]{24}(?:/trash)?',req.path,re.IGNORECASE))
  projects=(await bridge('projects',{'user':{'id':session['user_id'],'email':'session@cbgpu.com'},'includeTrashed':trash_action}))['projects']
  if not any(p['id']==project_match.group(1) for p in projects):return answer({'error':'Project not found'},404)
 headers={k:v for k,v in req.headers.items() if k.lower() not in HOP|{'host','cookie','authorization','x-cbgpu-key','x-cbgpu-identity','x-forwarded-for','x-forwarded-host','x-forwarded-proto'}}
 headers.update({'Host':'latex.cbgpu.com','X-Forwarded-Proto':'https','X-Forwarded-Host':'latex.cbgpu.com','Cookie':session['ce_cookie']})
 url='http://127.0.0.1:3521'+req.rel_url.path_qs
 if req.headers.get('Upgrade','').lower()=='websocket':
  if req.headers.get('Origin')!=PUBLIC:raise web.HTTPForbidden()
  async with http.ws_connect(url,headers=headers,max_msg_size=20*1024**2) as upstream:
   downstream=web.WebSocketResponse(max_msg_size=20*1024**2);await downstream.prepare(req)
   async def transfer(source,target):
    async for message in source:
     if message.type==WSMsgType.TEXT:await target.send_str(message.data)
     elif message.type==WSMsgType.BINARY:await target.send_bytes(message.data)
    await target.close()
   async def monitor():
    while not downstream.closed:
     await asyncio.sleep(20)
     if not await active(session['user_id'],session['native_session']):await downstream.close();await upstream.close();return
   tasks=[asyncio.create_task(transfer(downstream,upstream)),asyncio.create_task(transfer(upstream,downstream)),asyncio.create_task(monitor())]
   await asyncio.wait(tasks,return_when=asyncio.FIRST_COMPLETED)
   for task in tasks:task.cancel()
   await asyncio.gather(*tasks,return_exceptions=True)
   return downstream
 async with http.request(req.method,url,headers=headers,data=req.content if req.can_read_body else None,allow_redirects=False,timeout=ClientTimeout(total=360)) as upstream:
  response_headers={k:v for k,v in upstream.headers.items() if k.lower() not in HOP}
  response_headers.update({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff'})
  if 'text/html' in upstream.headers.get('Content-Type',''):
   raw=await upstream.read();inject=b'<link rel="stylesheet" href="/cbgpu/editor.css?v=20261029-green2"><script src="/cbgpu/editor.js?v=20261029-green2" defer></script><a class="cbgpu-return" href="https://researcher.cbgpu.com/latex">CBGPU &middot; Projects</a>'
   nonce=re.search(r"'nonce-([^']+)'",upstream.headers.get('Content-Security-Policy',''))
   if nonce:inject=inject.replace(b'<script ',b'<script nonce="'+nonce.group(1).encode()+b'" ')
   raw=raw.replace(b'</body>',inject+b'</body>');return web.Response(body=raw,status=upstream.status,headers=response_headers)
  response=web.StreamResponse(status=upstream.status,headers=response_headers);await response.prepare(req)
  async for chunk in upstream.content.iter_chunked(65536):await response.write(chunk)
  await response.write_eof();return response
async def cleanup():
 while True:
  await asyncio.sleep(300);now=time.time()
  for row in db.execute('SELECT id FROM uploads WHERE expires<?',(now,)).fetchall():(PRIVATE/'imports'/(row['id']+'.zip')).unlink(missing_ok=True)
  for row in db.execute('SELECT id FROM incoming WHERE expires<?',(now,)).fetchall():(PRIVATE/'imports'/(row['id']+'.partial')).unlink(missing_ok=True)
  for table in ('incoming','uploads','tickets','sessions','challenges'):db.execute(f'DELETE FROM {table} WHERE expires<?',(now,))
  db.commit();cache.clear()
async def start(app):
 global http
 http=ClientSession(auto_decompress=True);app['cleanup']=asyncio.create_task(cleanup())
async def stop(app):app['cleanup'].cancel();await http.close()
app=web.Application(client_max_size=0);app.router.add_route('*','/_api/{action}',api);app.router.add_get('/cbgpu/enter',enter);app.router.add_get('/cbgpu/connect',connect);app.router.add_route('*','/{path:.*}',proxy);app.on_startup.append(start);app.on_cleanup.append(stop)
if __name__=='__main__':web.run_app(app,host='127.0.0.1',port=3520,access_log=None)
