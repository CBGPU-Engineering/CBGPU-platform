const keyInput = document.querySelector('#key');
const serverInput = document.querySelector('#server');
const status = document.querySelector('#status');

async function load() {
  const data = await chrome.storage.local.get(['deviceKey', 'serverUrl', 'lastSyncAt', 'lastError']);
  keyInput.value = data.deviceKey || '';
  serverInput.value = data.serverUrl || 'https://cbgpu.vercel.app';
  if (data.lastError) {
    status.className = 'status error'; status.textContent = `최근 오류: ${data.lastError}`;
  } else if (data.lastSyncAt) {
    status.className = 'status ok'; status.textContent = `최근 동기화: ${new Date(data.lastSyncAt).toLocaleString('ko-KR')}`;
  } else {
    status.textContent = data.deviceKey ? '연결됨 · 다음 edu-set 로그인 시 동기화됩니다.' : '연결 키가 필요합니다.';
  }
}

document.querySelector('#save').addEventListener('click', async () => {
  const deviceKey = keyInput.value.trim();
  const serverUrl = serverInput.value.trim().replace(/\/$/, '');
  if (!deviceKey.startsWith('cbgpu_')) { status.className='status error'; status.textContent='올바른 연결 키를 입력해주세요.'; return; }
  await chrome.storage.local.set({ deviceKey, serverUrl, lastToken: '', lastError: '' });
  status.className='status ok'; status.textContent='저장됐습니다. edu-set 페이지를 새로고침하거나 로그인해주세요.';
});

load();
