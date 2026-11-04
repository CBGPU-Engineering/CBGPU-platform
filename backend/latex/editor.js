// Small responsive adapter around the original CE editor; no duplicated editor engine.
(()=>{
 if(!/^\/project\/[a-f0-9]{24}\/?$/.test(location.pathname))return;
 const root=document.documentElement;root.dataset.cbgpuEditorView='code';
 const nav=document.createElement('nav');nav.className='cbgpu-mobile-editor-nav';nav.setAttribute('aria-label','논문 편집 화면');
 nav.innerHTML='<a href="https://researcher.cbgpu.com/latex" aria-label="프로젝트 목록">목록</a><button data-view="files" aria-pressed="false">파일</button><button data-view="code" aria-pressed="true">코드</button><button data-view="pdf" aria-pressed="false">PDF</button><button data-compile>컴파일</button>';
 function view(mode){
  root.dataset.cbgpuEditorView=mode;nav.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===mode)));
  if(mode==='files')window.dispatchEvent(new CustomEvent('ui:select-rail-tab',{detail:{tab:'file-tree',open:true}}));
  window.dispatchEvent(new Event('resize'));
 }
 nav.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.view)view(button.dataset.view);
  else if(button.hasAttribute('data-compile')){
   view('pdf');const target=[...document.querySelectorAll('button')].find(b=>!nav.contains(b)&&/^Recompile$/.test(b.textContent.trim()));target?.click();
  }
 });
 document.body.appendChild(nav);
 document.addEventListener('click',event=>{
  const file=event.target.closest('.file-tree-entity-button');
  if(matchMedia('(max-width:767px)').matches&&file&&/\.(tex|bib|sty|cls|txt|md|png|jpe?g|pdf)\s*$/i.test(file.textContent.trim()))setTimeout(()=>view('code'),150);
 });
})();
