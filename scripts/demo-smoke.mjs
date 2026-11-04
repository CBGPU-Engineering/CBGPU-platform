import {createRequire}from'node:module';import assert from'node:assert/strict';
const require=createRequire(import.meta.url),puppeteer=require('../FrontEnd/cbgpu/node_modules/puppeteer-core'),playwright=require('../FrontEnd/cbgpu/node_modules/playwright');
const base='http://localhost:3100';let ready=false;
for(let i=0;i<90;i++){try{const r=await fetch(base);if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,1000))}assert.ok(ready,'Demo did not become ready');
const browser=await puppeteer.launch({executablePath:process.env.CHROME_BIN||playwright.chromium.executablePath(),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage();await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});const external=[];
 await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(['http:','https:','ws:','wss:'].includes(u.protocol)&&!['localhost','127.0.0.1'].includes(u.hostname)){external.push(u.origin);return r.abort()}r.continue()});
 await page.goto(base+'/auth/login',{waitUntil:'networkidle2'});await page.waitForSelector('[aria-label="Local demo"]');await page.type('#login-email','student@example.invalid');await page.type('#login-password','demo-only');await page.click('button[type=submit]');await page.waitForFunction(()=>location.pathname!=='/auth/login');
 await page.goto(base+'/study',{waitUntil:'networkidle2'});await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='EduSet 로그인'&&!b.disabled));
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='EduSet 로그인').click());await page.waitForSelector('[data-study-request-dialog]');await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Connect demo student').click());await page.waitForSelector('[data-study-request-dialog]',{hidden:true});
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='자습 신청하기').click());
 const select=async(label,value)=>{await page.evaluate(label=>{const el=[...document.querySelectorAll('[data-study-request-dialog] label')].find(e=>e.textContent.startsWith(label)).querySelector('select');el.dataset.smoke=label},label);await page.select('[data-smoke="'+label+'"]',value)};
 await select('교실','1');await page.waitForFunction(()=>[...document.querySelectorAll('option')].some(o=>o.value==='1'&&o.textContent==='1번'));await select('좌석','1');await select('담당 선생님','demo-teacher');await page.type('[data-study-request-dialog] textarea','Demo only');
 await page.click('[data-study-request-dialog] button[type=submit]');await page.waitForSelector('[data-study-request-dialog]',{hidden:true});await page.waitForFunction(()=>document.querySelector('[aria-label="내 자습 신청"]').textContent.includes('승인 대기'));
 await page.reload({waitUntil:'networkidle2'});await page.waitForFunction(()=>document.querySelector('[aria-label="내 자습 신청"]')?.textContent.includes('승인 대기'));page.once('dialog',d=>d.accept());await page.evaluate(()=>[...document.querySelectorAll('[aria-label="내 자습 신청"] button')].find(b=>b.textContent==='취소').click());await page.waitForFunction(()=>document.querySelector('[aria-label="내 자습 신청"]').textContent.includes('오늘 신청한 자습이 없어요.'));
 await page.goto(base+'/dashboard?mode=researcher',{waitUntil:'networkidle2'});assert.ok((await page.$eval('body',e=>e.textContent)).includes('GPU'));assert.equal(new URL(page.url()).hostname,'localhost');assert.deepEqual(external,[],'Demo attempted an external network request');
 console.log('PASS local browser demo: synthetic login, school connect/apply/reload/cancel, GPU view, mobile UI, no external requests.');
}finally{await browser.close()}
