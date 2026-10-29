import { state } from './state.js';
import { dom } from './dom.js';
import { generateClientId, urlB64ToUint8Array } from './utils.js';
import { saveToStorage } from './storage.js';
import { updateCurrentUserNick, buildChatList } from './ui.js';
import { playSelfSendSound } from './sounds.js';

export function initSocket() {
  const socket = io();
  window._socket = socket;



  dom.joinBtn.addEventListener('click', () => {
    const name = dom.nameInput.value.trim();
    if (!name) return;
    if (name.length > 15) { dom.errorDiv.textContent = 'Имя слишком длинное (макс. 15 символов)'; return; }
    let userId = localStorage.getItem('userId');
    if (!userId) { userId = generateClientId(); localStorage.setItem('userId', userId); }
    socket.emit('join', { name, userId });
    if (!state.audioContext) state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    // Request browser notification permission explicitly
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') subscribeToPush(socket);
      });
    }
  });

  dom.nameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') dom.joinBtn.click(); });

  socket.on('joinError', (msg) => { dom.errorDiv.textContent = msg; if (state.currentUser) { localStorage.removeItem('userName'); localStorage.removeItem('userId'); location.reload(); } });

  socket.on('joined', (user) => {
    state.currentUser = user;
    localStorage.setItem('userName', user.name);
    localStorage.setItem('userId', user.id);
    updateCurrentUserNick();
    if (!state.audioContext) state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    dom.loginDiv.style.display = 'none';
    dom.chatDiv.style.display = 'flex';
    subscribeToPush(socket);
    history.replaceState({ screen: 'chatlist' }, '');
    startLastSeenTimer();
    socket.emit('get users');
  });

  async function subscribeToPush(s) {
    if (state.pushSubscriptionAttempted) return;
    state.pushSubscriptionAttempted = true;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      let perm = Notification.permission;
      if (perm === 'default') {
        perm = await Notification.requestPermission();
      }
      if (perm === 'denied') return;
      const publicKeyResp = await fetch('/api/vapid-public-key');
      const { publicKey } = await publicKeyResp.json();
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      await registration.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey)
      });
      await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.currentUser.id, subscription }) });
    } catch (err) { console.error(err); }
  }

  function startLastSeenTimer() {
    if (state.lastSeenTimer) clearInterval(state.lastSeenTimer);
    state.lastSeenTimer = setInterval(() => { buildChatList(); import('./ui.js').then(m => m.updateChatTitle()); }, 60000);
  }

  return socket;
}
