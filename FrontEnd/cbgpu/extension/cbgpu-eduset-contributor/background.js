const DEFAULT_SERVER = 'https://cbgpu.com';
async function migrateServer() {
  const data = await chrome.storage.local.get(['serverUrl']);
  if (data.serverUrl !== DEFAULT_SERVER) await chrome.storage.local.set({serverUrl: DEFAULT_SERVER, lastToken: '', lastSyncAt: '', lastError: ''});
}
chrome.runtime.onInstalled.addListener(() => { void migrateServer(); });
chrome.runtime.onStartup.addListener(() => { void migrateServer(); });
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'EDUSET_TOKEN' || typeof message.token !== 'string' || !message.token) return;
  if (!sender.url || new URL(sender.url).origin !== 'https://cbsh.edu-set.com') { sendResponse({ok:false,message:'공식 edu-set 페이지에서만 동기화할 수 있습니다.'}); return; }
  syncToken(message.token).then(sendResponse).catch(() => sendResponse({ok:false,message:'동기화를 다시 시도해 주세요.'}));
  return true;
});
async function syncToken(accessToken) {
  await migrateServer();
  const {deviceKey,lastToken,lastServer,lastDeviceKey} = await chrome.storage.local.get(['deviceKey','lastToken','lastServer','lastDeviceKey']);
  if (!deviceKey) return {ok:false,message:'확장 프로그램 설정에 연결 키를 입력해주세요.'};
  if (lastToken === accessToken && lastServer === DEFAULT_SERVER && lastDeviceKey === deviceKey) return {ok:true,skipped:true};
  try {
    const response = await fetch(DEFAULT_SERVER+'/api/study/contributor/sync', {
      method:'POST', headers:{'Content-Type':'application/json','x-cbgpu-device':deviceKey},
      body:JSON.stringify({accessToken}), redirect:'error', signal:AbortSignal.timeout(15000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `HTTP ${response.status}`);
    await chrome.storage.local.set({lastToken:accessToken,lastServer:DEFAULT_SERVER,lastDeviceKey:deviceKey,lastSyncAt:new Date().toISOString(),lastError:''});
    return {ok:true};
  } catch (error) {
    const message = error.message || String(error);
    await chrome.storage.local.set({lastError:message});
    return {ok:false,message};
  }
}
