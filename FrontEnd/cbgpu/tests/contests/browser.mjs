// Run against a local production server: node tests/contests/browser.mjs
// All Supabase traffic is mocked; no users or submissions are created remotely.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
process.loadEnvFile('.env.local');
const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
const hostId = '00000000-0000-4000-8000-000000000001';
const participantId = '00000000-0000-4000-8000-000000000002';
const contestId = '10000000-0000-4000-8000-000000000001';
let contests = [];
let submissions = [];
let currentUserId = hostId;
let logoBytes;
const serverNow = () => Date.now() + 5 * 60 * 1000;

(async () => {
  const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
  try {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.setRequestInterception(true);
    page.on('request', async request => {
      if (!request.url().startsWith(origin)) {
        if (request.url().startsWith('http://localhost:3147')) return request.continue();
        return request.abort();
      }
      const url = new URL(request.url());
      const path = url.pathname;
      if (path.includes('/storage/v1/object/public/contest-logos/') && logoBytes) return request.respond({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: logoBytes });
      let result = [];
      let status = 200;
      if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      if (path.includes('rpc/contest_server_time')) result = new Date(serverNow()).toISOString();
      else if (path.includes('/profiles')) result = { id: currentUserId, full_name: currentUserId === hostId ? '호스트' : '참가자', student_id: '1234' };
      else if (path.endsWith('/contests')) {
        if (request.method() === 'POST') {
          contests = [{ ...JSON.parse(request.postData()), id: contestId, is_open: true, created_at: new Date().toISOString() }];
          result = { id: contestId };
          status = 201;
        } else if (request.method() === 'PATCH') {
          contests[0] = { ...contests[0], ...JSON.parse(request.postData()) };
          result = contests[0];
        } else result = contests;
      } else if (path.endsWith('/contest_submissions')) {
        if (request.method() === 'POST') {
          submissions = [{ ...JSON.parse(request.postData()), submitted_at: new Date(serverNow()).toISOString() }];
          result = submissions[0];
          status = 201;
        } else result = submissions;
      } else if (path.includes('/auth/v1/user')) result = { id: currentUserId, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid' };
      else if (path.includes('/storage/')) result = { Key: 'fixture' };
      await request.respond({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-range': '0-0/1' }, body: JSON.stringify(result) });
    });
    async function loginAs(id) {
      currentUserId = id;
      await page.evaluateOnNewDocument((id, origin) => {
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const payload = { sub: id, aud: 'authenticated', role: 'authenticated', exp };
        const token = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + btoa(JSON.stringify(payload)) + '.fixture';
        localStorage.setItem(`sb-${new URL(origin).hostname.split('.')[0]}-auth-token`, JSON.stringify({ access_token: token, refresh_token: 'fixture', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { ...payload, id, email: 'fixture@example.invalid', user_metadata: {}, app_metadata: {} } }));
      }, id, origin);
    }
    async function click(text) {
      await page.waitForFunction(text => [...document.querySelectorAll('button,a')].some(el => el.textContent.trim() === text && !el.matches(':disabled')), {}, text);
      await page.evaluate(text => [...document.querySelectorAll('button,a')].find(el => el.textContent.trim() === text).click(), text);
    }
    async function fill(label, value) {
      const handle = await page.evaluateHandle(label => [...document.querySelectorAll('label')].find(el => el.textContent.includes(label)).querySelector('input,textarea'), label);
      await handle.type(value);
      await handle.dispose();
    }
    await loginAs(hostId);
    await page.goto('http://localhost:3147/contests/new');
    await page.waitForSelector('input[maxlength="120"]');
    const logoData = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const context = canvas.getContext('2d');
      context.fillStyle = '#eef5e9'; context.fillRect(0, 0, 256, 256);
      context.fillStyle = '#17634d'; context.beginPath(); context.arc(128, 128, 94, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#d8ecc9'; context.font = 'bold 140px sans-serif'; context.textAlign = 'center'; context.fillText('C', 128, 179);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    logoBytes = Buffer.from(logoData, 'base64');
    fs.writeFileSync('/tmp/cbgpu-test-logo.png', logoBytes);
    const logoInput = await page.$('input[aria-label="대회 로고 파일"]');
    await logoInput.uploadFile('/tmp/cbgpu-test-logo.png');
    await page.waitForSelector('img[alt="대회 로고 미리보기"]');
    await fill('대회 이름', '테스트 발표 대회');
    await click('파일 추가');
    await fill('항목 이름', '발표 자료');
    await fill('이 항목의 허용 확장자', '.ppt,.pptx');
    await click('텍스트 추가');
    const titleInputs = await page.$$('input[maxlength="200"]');
    await titleInputs[titleInputs.length - 1].type('작품 소개');
    await click('링크 추가');
    const allTitleInputs = await page.$$('input[maxlength="200"]');
    await allTitleInputs[allTitleInputs.length - 1].type('시연 링크');
    const deadline = new Date(serverNow() + 86461000 + 9 * 3600000).toISOString().slice(0, 19);
    await page.$eval('input[type="datetime-local"]', (el, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, deadline);
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(el => el.textContent.includes('대회 생성하고')).disabled);
    await click('대회 생성하고 제출 링크 받기');
    await page.waitForFunction(() => document.body.textContent.includes('호스트 · 대회 관리'));
    assert.equal(contests[0].fields[0].extensions, '.ppt,.pptx');
    assert.ok(contests[0].logo_path.startsWith(`${hostId}/`));
    assert.equal(contests[0].ends_at, new Date(`${deadline}+09:00`).toISOString());
    await page.waitForFunction(() => document.body.textContent.includes('1일 0시간 1분'));
    await page.screenshot({ path: '/tmp/cbgpu-contest-host-mobile.png', fullPage: true });
    await loginAs(participantId);
    await page.goto(`http://localhost:3147/contests/${contestId}`);
    await page.waitForFunction(() => document.body.textContent.includes('참가자 · 제출하기'));
    await page.waitForFunction(() => document.body.textContent.includes('1일 0시간 1분'));
    await page.screenshot({ path: '/tmp/cbgpu-contest-participant-mobile.png', fullPage: true });
    const fileInput = await page.$('input[type="file"]');
    fs.writeFileSync('/tmp/cbgpu-test-slides.pptx', 'PowerPoint upload fixture');
    await fileInput.uploadFile('/tmp/cbgpu-test-slides.pptx');
    await page.type('textarea', '작품 소개 내용');
    await page.type('input[type="url"]', 'https://example.com/demo');
    await click('대회 제출하기');
    await page.waitForFunction(() => document.body.textContent.includes('제출 완료'));
    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].user_id, participantId);
    assert.ok(Object.values(submissions[0].answers).includes('작품 소개 내용'));
    assert.ok(Object.values(submissions[0].answers).includes('https://example.com/demo'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile layout fits viewport');
    await loginAs(hostId);
    await page.goto(`http://localhost:3147/contests/${contestId}`);
    await page.waitForFunction(() => document.body.textContent.includes('받은 제출물 1건'));
    await page.click('summary');
    assert.equal(await page.$eval('details[open]', el => el.textContent.includes('작품 소개 내용') && el.textContent.includes('https://example.com/demo') && el.textContent.includes('cbgpu-test-slides.pptx')), true);
    await page.screenshot({ path: '/tmp/cbgpu-contest-host-results-mobile.png', fullPage: true });
    await click('제거');
    await click('로고 저장');
    await page.waitForFunction(() => !document.querySelector('.contest-hero img[alt$=" 로고"]'));
    assert.equal(contests[0].logo_path, null);
    const replacementInput = await page.$('input[aria-label="대회 로고 파일"]');
    await replacementInput.uploadFile('/tmp/cbgpu-test-logo.png');
    await page.waitForSelector('img[alt="대회 로고 미리보기"]');
    await click('로고 저장');
    await page.waitForSelector('.contest-hero img[alt$=" 로고"]');
    assert.ok(contests[0].logo_path);
    await loginAs(participantId);
    contests[0].ends_at = new Date(serverNow() - 1000).toISOString();
    await page.goto(`http://localhost:3147/contests/${contestId}`);
    await page.waitForFunction(() => document.body.textContent.includes('제출이 마감되었어요'));
    assert.equal(await page.$eval('button[type="submit"]', el => el.matches(':disabled')), true);
    contests[0].ends_at = new Date(serverNow() + 86461000).toISOString();
    await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
    await page.reload();
    await page.waitForFunction(() => document.body.textContent.includes('1일 0시간 1분'));
    await page.screenshot({ path: '/tmp/cbgpu-contest-detail-desktop.png', fullPage: true });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.screenshot({ path: '/tmp/cbgpu-contest-detail-dark.png', fullPage: true });
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    contests = [contests[0], { ...contests[0], id: '10000000-0000-4000-8000-000000000002', logo_path: null, title: '창의융합 탐구대회', description: '다양한 분야의 경계를 넘어, 우리만의 새로운 질문을 탐구해요.' }, { ...contests[0], id: '10000000-0000-4000-8000-000000000003', title: '과학 영상 공모전', is_open: false, description: '어려운 과학을 나만의 시선으로. 과학의 재미를 영상으로 들려주세요.' }];
    await page.goto('http://localhost:3147/contests');
    await page.waitForSelector('.contest-card');
    await page.screenshot({ path: '/tmp/cbgpu-contest-list-desktop.png', fullPage: true });
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.screenshot({ path: '/tmp/cbgpu-contest-list-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'list fits mobile viewport');
    assert.deepEqual(errors, []);
    console.log('PASS: logo upload/preview/removal/replacement, mobile/desktop/dark layouts, custom extensions, server countdown, file/link/text submission, host results and deadline lock');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
