let lastToken = '', pending = false, retryAfter = 0;
function checkToken() {
  const token = localStorage.getItem('accessToken') || '';
  if (!token || token === lastToken || pending || Date.now() < retryAfter) return;
  pending = true;
  chrome.runtime.sendMessage({type:'EDUSET_TOKEN',token}, response => {
    pending = false;
    if (chrome.runtime.lastError || !response?.ok) { retryAfter = Date.now()+30000; return; }
    lastToken = token; retryAfter = 0;
  });
}
checkToken();
setInterval(checkToken,3000);
window.addEventListener('storage',checkToken);
