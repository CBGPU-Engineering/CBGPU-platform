const DEFAULT_SERVER = 'https://cbgpu.vercel.app';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'EDUSET_TOKEN' || !message.token) return;
  syncToken(message.token).then(sendResponse);
  return true;
});

async function syncToken(accessToken) {
  const { deviceKey, serverUrl = DEFAULT_SERVER, lastToken } = await chrome.storage.local.get(['deviceKey', 'serverUrl', 'lastToken']);
  if (!deviceKey) return { ok: false, message: '확장 프로그램 설정에 연결 키를 입력해주세요.' };
  if (lastToken === accessToken) return { ok: true, skipped: true };

  try {
    const response = await fetch(`${serverUrl.replace(/\/$/, '')}/api/study/contributor/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cbgpu-device': deviceKey },
      body: JSON.stringify({ accessToken }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `HTTP ${response.status}`);
    await chrome.storage.local.set({ lastToken: accessToken, lastSyncAt: new Date().toISOString(), lastError: '' });
    return { ok: true };
  } catch (error) {
    await chrome.storage.local.set({ lastError: error.message || String(error) });
    return { ok: false, message: error.message || String(error) };
  }
}
