import { state } from './state.js';
import { dom } from './dom.js';
import { generateClientId, urlB64ToUint8Array } from './utils.js';
import { saveToStorage } from './storage.js';
import { updateCurrentUserNick, buildChatList } from './ui.js';
import { playSelfSendSound } from './sounds.js';

export function initSocket() {
  const socket = io();
  window._socket = socket;

  socket.on('connect', () => console.log('Socket connected:', socket.id));
  socket.on('connect_error', (err) => console.error('Socket connect error:', err));
  socket.on('disconnect', (reason) => console.log('Socket disconnected:', reason));

  dom.joinBtn.addEventListener('click', () => {
    console.log('Join button clicked');
    const name = dom.nameInput.value.trim();
    console.log('Name:', name, 'trimmed:', name ? 'not empty' : 'EMPTY');
    if (!name) return;
    let userId = localStorage.getItem('userId');
    if (!userId) { userId = generateClientId(); localStorage.setItem('userId', userId); }
    console.log('Emitting join:', { name, userId }, 'socket connected?', socket.connected);
    socket.emit('join', { name, userId });
    console.log('Join emitted');
    if (!state.audioContext) state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  });

  dom.nameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') dom.joinBtn.click(); });

  socket.on('joinError', (msg) => { console.error('joinError:', msg); dom.errorDiv.textContent = msg; if (state.currentUser) { localStorage.removeItem('userName'); localStorage.removeItem('userId'); location.reload(); } });

  socket.on('joined', (user) => {
    console.log('Received joined event:', user);
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
    if (Notification.permission === 'denied') return;
    if (Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) await existing.unsubscribe();
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array('BK0ZuTTtvnwKTDxfjMrMTeYWoAejPX_J6PIHPMwvx6b5J3V3LuM8MV91d1wbb_kDj7huTVQgryycEgzCTIKdcNk')
        });
        await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.currentUser.id, subscription }) });
      } catch (err) { console.error(err); }
    } else {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') await subscribeToPush(s);
    }
  }

  function startLastSeenTimer() {
    if (state.lastSeenTimer) clearInterval(state.lastSeenTimer);
    state.lastSeenTimer = setInterval(() => { buildChatList(); import('./ui.js').then(m => m.updateChatTitle()); }, 60000);
  }

  return socket;
}
