"""Validate and normalize a LaTeX project without extracting untrusted files on the host."""
import io,re,stat,unicodedata,zipfile,shutil
MAX_FILES=1000
class ImportError(ValueError):pass

def inspect_zip(raw,output_path=None):
 try:z=zipfile.ZipFile(io.BytesIO(raw) if isinstance(raw,(bytes,bytearray)) else raw)
 except (zipfile.BadZipFile,ValueError):raise ImportError('올바른 ZIP 파일이 아닙니다. Overleaf에서 소스 ZIP을 다시 내려받아 주세요.')
 entries=[];seen=set();total=0;warnings=[]
 try:
  if len(z.infolist())>MAX_FILES+100:raise ImportError('파일이 너무 많습니다. 프로젝트당 최대 1,000개입니다.')
  for info in z.infolist():
   name=info.filename
   if '\\' in name or name.startswith('/') or re.match(r'^[A-Za-z]:',name) or any(c in name for c in '\x00\r\n') or '..' in name.split('/') or any(ord(c)<32 for c in name):raise ImportError('안전하지 않은 ZIP 경로입니다: '+name[:100])
   if info.flag_bits&1:raise ImportError('암호화된 ZIP은 가져올 수 없습니다. 암호 없이 다시 압축해 주세요.')
   if stat.S_ISLNK(info.external_attr>>16):raise ImportError('심볼릭 링크가 포함된 ZIP은 가져올 수 없습니다.')
   if info.is_dir():continue
   parts=name.split('/')
   if any(x in ('__MACOSX','.git','node_modules') for x in parts) or parts[-1] in ('.DS_Store','Thumbs.db'):continue
   if not name or any(not p or p=='.' for p in parts) or len(name)>500:raise ImportError('지원하지 않는 파일 경로입니다.')
   if unicodedata.normalize('NFC',name).casefold() in seen:raise ImportError('이름이 겹치는 파일이 있습니다: '+name[:100])
   seen.add(unicodedata.normalize('NFC',name).casefold());total+=info.file_size
   if info.file_size>1024**2 and info.file_size>max(1,info.compress_size)*300:raise ImportError('비정상적으로 압축률이 높은 ZIP입니다.')
   if len(entries)>=MAX_FILES:raise ImportError('프로젝트당 최대 1,000개 파일을 지원합니다.')
   entries.append([name,info])
  if not entries:raise ImportError('ZIP 안에 프로젝트 파일이 없습니다.')
  # Strip only shared directory wrappers; never flatten actual source subdirectories.
  while all('/' in name for name,_ in entries) and len({name.split('/')[0] for name,_ in entries})==1:
   wrapper=entries[0][0].split('/')[0];entries=[[name[len(wrapper)+1:],data] for name,data in entries]
   warnings.append('상위 폴더 '+wrapper+'를 프로젝트 루트로 정리했습니다.')
  tex=[];candidates=[];compiler='pdflatex'
  for name,member in entries:
   if not name.lower().endswith('.tex'):continue
   tex.append(name)
   try:text=z.read(member).decode('utf-8-sig')
   except UnicodeDecodeError:
    raise ImportError('UTF-8이 아닌 TeX 파일입니다: '+name+'. UTF-8로 저장한 뒤 다시 압축해 주세요.')
   clean=re.sub(r'(?m)(?<!\\)%.*$','',text)
   if re.search(r'\\documentclass(?:\s*\[[^\]]*\])?\s*\{(?!subfiles\})',clean):candidates.append(name)
   magic=re.search(r'(?im)^%\s*!\s*TeX\s+program\s*=\s*(xelatex|lualatex|pdflatex)',text)
   if magic:compiler=magic.group(1).lower()
   elif compiler=='pdflatex' and re.search(r'\\(?:usepackage(?:\[[^\]]*\])?\{(?:fontspec|kotex|xeCJK)|setmainfont)|[가-힣]',text):compiler='xelatex'
  if not tex:raise ImportError('.tex 파일이 없습니다. PDF ZIP이 아닌 LaTeX 소스 ZIP을 올려 주세요.')
  candidates=sorted(candidates or tex,key=lambda p:(p.lower().split('/')[-1] not in ('main.tex','manuscript.tex','paper.tex'),p.count('/'),p))
  output=output_path if output_path is not None else io.BytesIO()
  with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as target:
   for name,member in entries:
    with z.open(member) as source,target.open(name,'w',force_zip64=True) as dest:shutil.copyfileobj(source,dest,1024*1024)
  return {'zip':output.getvalue() if output_path is None else None,'files':[name for name,_ in entries],'candidates':candidates,'suggested_main':candidates[0],'compiler':compiler,'warnings':warnings,'size':total,'count':len(entries)}
 except (zipfile.BadZipFile,RuntimeError,NotImplementedError):raise ImportError('ZIP 파일이 손상되었거나 지원하지 않는 압축 방식입니다.')
 finally:z.close()
