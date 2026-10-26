export function generateClientId() {
  return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

export function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function escapeHtml(text = '') {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

export function linkify(text = '') {
  if (!text) return '';
  const escaped = escapeHtml(text);
  const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
  return escaped.replace(urlRegex, (url) => {
    let href = url;
    if (href.toLowerCase().startsWith('www.')) href = 'https://' + href;
    if (/^javascript:/i.test(href)) return url;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="message-link">${url}</a>`;
  });
}

export function formatLastSeen(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'только что';
  if (diff < 3600000) return `${Math.floor(diff/60000)} мин. назад`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)} ч. назад`;
  return new Date(timestamp).toLocaleDateString();
}

export function isVideoUrl(url) {
  return /\.(mp4|webm|ogg|mov|avi)$/i.test(url);
}
