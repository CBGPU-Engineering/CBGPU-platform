let lastToken = '';

function checkToken() {
  const token = localStorage.getItem('accessToken') || '';
  if (!token || token === lastToken) return;
  lastToken = token;
  chrome.runtime.sendMessage({ type: 'EDUSET_TOKEN', token });
}

checkToken();
setInterval(checkToken, 3000);
window.addEventListener('storage', checkToken);
