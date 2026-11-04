import io,unittest,zipfile,stat,os,tempfile
from zip_import import inspect_zip,ImportError

def archive(files):
 data=io.BytesIO()
 with zipfile.ZipFile(data,'w',zipfile.ZIP_DEFLATED) as z:
  for name,body in files.items():z.writestr(name,body)
 return data.getvalue()
class Imports(unittest.TestCase):
 def test_journal_project_preserves_tree(self):
  raw=archive({'paper/main.tex':r'\documentclass{article}\begin{document}\input{sections/intro}\end{document}','paper/sections/intro.tex':'Research','paper/refs.bib':'@article{x,title={X}}','paper/figures/a.png':b'\x89PNG','paper/journal.cls':'% cls'})
  result=inspect_zip(raw);self.assertEqual(result['suggested_main'],'main.tex');self.assertIn('sections/intro.tex',result['files']);self.assertIn('figures/a.png',result['files']);self.assertIn('refs.bib',result['files'])
  with zipfile.ZipFile(io.BytesIO(result['zip'])) as z:self.assertEqual(z.read('figures/a.png'),b'\x89PNG')
 def test_multiple_main_documents(self):
  result=inspect_zip(archive({'main.tex':r'\documentclass{article}','supplement.tex':r'\documentclass{article}','sections/body.tex':'text'}));self.assertEqual(result['candidates'],['main.tex','supplement.tex'])
 def test_nested_main_and_korean(self):
  result=inspect_zip(archive({'paper/source/manuscript.tex':r'\documentclass{article}\usepackage{kotex} 안녕','paper/figures/a.pdf':b'%PDF'}));self.assertEqual(result['suggested_main'],'source/manuscript.tex');self.assertEqual(result['compiler'],'xelatex')
 def test_paths_rejected(self):
  for name in ['../evil.tex','a/../../evil.tex','/root.tex','C:/main.tex','a\\main.tex']:
   with self.subTest(name=name),self.assertRaises(ImportError):inspect_zip(archive({name:r'\documentclass{article}'}))
 def test_case_collision(self):
  with self.assertRaises(ImportError):inspect_zip(archive({'main.tex':'x','Main.tex':'y'}))
 def test_zip_bomb(self):
  with self.assertRaises(ImportError):inspect_zip(archive({'main.tex':'x','bomb.bin':b'0'*3000000}))
 def test_no_source(self):
  with self.assertRaises(ImportError):inspect_zip(archive({'paper.pdf':b'%PDF'}))
 def test_symlink(self):
  raw=io.BytesIO()
  with zipfile.ZipFile(raw,'w') as z:
   info=zipfile.ZipInfo('main.tex');info.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(info,'/etc/passwd')
  with self.assertRaises(ImportError):inspect_zip(raw.getvalue())
 def test_large_zip_limit(self):
  # Multiple legal-size assets produce a valid archive above the old 20 MiB cap.
  raw=archive({'main.tex':r'\documentclass{article}','a.bin':os.urandom(11*1024**2),'b.bin':os.urandom(11*1024**2)})
  self.assertGreater(len(raw),20*1024**2)
  self.assertEqual(inspect_zip(raw)['count'],3)
 def test_expanded_total_and_large_member_allowed(self):
  # 168 MiB expanded, 21 MiB per member, with a modest compression ratio.
  payload=os.urandom(16384)*(21*64)
  raw=archive({'main.tex':r'\documentclass{article}',**{f'asset-{i}.bin':payload for i in range(8)}})
  result=inspect_zip(raw)
  self.assertGreater(result['size'],150*1024**2)
  with zipfile.ZipFile(io.BytesIO(result['zip'])) as z:
   self.assertEqual(z.read('asset-7.bin'),payload)
 def test_no_compressed_byte_cap_and_disk_output(self):
  with tempfile.TemporaryDirectory() as folder:
   source=os.path.join(folder,'source.zip');output=os.path.join(folder,'normalized.zip')
   with zipfile.ZipFile(source,'w',zipfile.ZIP_STORED) as z:
    z.writestr('main.tex',r'\documentclass{article}')
    # More than the former 50 MiB cap without constructing a huge input buffer.
    with z.open('large.bin','w',force_zip64=True) as dest:
     block=os.urandom(1024**2)
     for _ in range(51):dest.write(block)
   self.assertGreater(os.path.getsize(source),50*1024**2)
   result=inspect_zip(source,output);self.assertIsNone(result['zip'])
   self.assertEqual(result['count'],2)
   with zipfile.ZipFile(output) as z:self.assertEqual(z.getinfo('large.bin').file_size,51*1024**2)
 def test_corrupt(self):
  with self.assertRaises(ImportError):inspect_zip(b'not a zip')
if __name__=='__main__':unittest.main()
