// ==UserScript==
// @name         CBGPU 자습 조회 기여자
// @namespace    https://cbgpu.vercel.app/
// @version      1.1.0
// @description  edu-set 로그인 토큰을 CBGPU 자습 조회에 자동으로 기여합니다.
// @author       CBGPU
// @match        https://cbsh.edu-set.com/*
// @connect      cbgpu.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  https://cbgpu.com/downloads/cbgpu-eduset-contributor.user.js
// @updateURL    https://cbgpu.com/downloads/cbgpu-eduset-contributor.user.js
// ==/UserScript==

(function () {
  'use strict';

  const SERVER = 'https://cbgpu.com';
  let observedToken = '', pending = false, retryAfter = 0;

  function notify(message, error = false) {
    const old = document.querySelector('#cbgpu-contributor-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'cbgpu-contributor-toast';
    el.textContent = message;
    Object.assign(el.style, {
      position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483647',
      padding: '12px 16px', borderRadius: '12px', color: '#fff', fontSize: '13px',
      fontWeight: '700', background: error ? '#b42318' : '#087443', boxShadow: '0 8px 30px #0005',
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  async function configure() {
    const current = await GM_getValue('deviceKey', '');
    const value = prompt('CBGPU 기여자 페이지에서 발급받은 연결 키를 붙여넣어 주세요.', current);
    if (value === null) return false;
    const key = value.trim();
    if (!key.startsWith('cbgpu_')) {
      notify('올바른 CBGPU 연결 키가 아닙니다.', true);
      return false;
    }
    await GM_setValue('deviceKey', key);
    await GM_setValue('lastToken', '');
    observedToken = '';
    notify('CBGPU 연결 키를 저장했습니다.');
    setTimeout(check, 100);
    return true;
  }

  async function importKeyFromUrl() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    const key = (params.get('cbgpu-key') || '').trim();
    if (!key.startsWith('cbgpu_')) return '';
    await GM_setValue('deviceKey', key);
    await GM_setValue('lastToken', '');
    history.replaceState(null, '', location.pathname + location.search);
    notify('CBGPU 연결 키가 자동으로 등록됐습니다.');
    return key;
  }

  function upload(token, deviceKey) {
    pending = true;
    const fail = message => {pending=false;retryAfter=Date.now()+30000;notify(message,true);};
    GM_xmlhttpRequest({
      method: 'POST',
      timeout: 15000,
      url: `${SERVER}/api/study/contributor/sync`,
      headers: { 'Content-Type': 'application/json', 'x-cbgpu-device': deviceKey },
      data: JSON.stringify({ accessToken: token }),
      onload: async (response) => {
        let body = {};
        try { body = JSON.parse(response.responseText); } catch {}
        if (response.status >= 200 && response.status < 300) {
          await GM_setValue('lastToken', token);
          await GM_setValue('lastServer', SERVER);
          pending=false;retryAfter=0;observedToken=token;
          notify('CBGPU 자습 조회 토큰이 자동 갱신됐습니다.');
        } else {
          fail(body.message || `CBGPU 동기화 실패 (HTTP ${response.status})`);
        }
      },
      onerror: () => fail('CBGPU 서버에 연결하지 못했습니다. 30초 후 다시 시도합니다.'),
      ontimeout: () => fail('CBGPU 연결 시간이 초과됐습니다. 30초 후 다시 시도합니다.'),
      onabort: () => fail('CBGPU 동기화가 중단됐습니다.'),
    });
  }

  async function check() {
    const importedKey = await importKeyFromUrl();
    let deviceKey = importedKey || await GM_getValue('deviceKey', '');
    if (!deviceKey) {
      if (!(await configure())) return;
      deviceKey = await GM_getValue('deviceKey', '');
    }
    const token = localStorage.getItem('accessToken') || '';
    if (!token || token === observedToken || pending || Date.now()<retryAfter) return;
    const lastToken = await GM_getValue('lastToken', '');
    const lastServer = await GM_getValue('lastServer', '');
    if (lastToken !== token || lastServer !== SERVER) upload(token, deviceKey);
    else observedToken = token;
  }

  GM_registerMenuCommand('CBGPU 연결 키 변경', configure);
  check();
  setInterval(check, 3000);
  window.addEventListener('storage', check);
})();
