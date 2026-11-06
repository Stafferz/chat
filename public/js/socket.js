import { state } from './state.js';
import { dom } from './dom.js';
import { generateClientId, urlB64ToUint8Array } from './utils.js';
import { saveToStorage } from './storage.js';
import { updateCurrentUserNick, buildChatList } from './ui.js';
import { playSelfSendSound } from './sounds.js';

export function initSocket() {
  const socket = io();
  window._socket = socket;


  const reportPageVisibility = () => {
    socket.emit('page visibility', { visible: document.visibilityState === 'visible' });
  };
  document.addEventListener('visibilitychange', reportPageVisibility);
  socket.on('connect', reportPageVisibility);

  function updateNotificationButton({ subscribed = false, error = false } = {}) {
    if (!dom.notificationBtn) return;
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    if (!supported || subscribed) {
      dom.notificationBtn.style.display = 'none';
      return;
    }

    dom.notificationBtn.style.display = 'inline-block';
    dom.notificationBtn.disabled = false;
    if (Notification.permission === 'denied') {
      dom.notificationBtn.textContent = '🔕';
      dom.notificationBtn.title = 'Уведомления заблокированы в настройках браузера';
    } else if (error) {
      dom.notificationBtn.textContent = '⚠️';
      dom.notificationBtn.title = 'Не удалось подключить уведомления — нажмите, чтобы повторить';
    } else {
      dom.notificationBtn.textContent = '🔔';
      dom.notificationBtn.title = 'Включить уведомления';
    }
  }

  updateNotificationButton();

  dom.notificationBtn?.addEventListener('click', async () => {
    if (Notification.permission === 'denied') {
      alert('Уведомления заблокированы. Разрешите их в настройках сайта в браузере, затем обновите страницу.');
      return;
    }
    await subscribeToPush(socket, true);
  });

  dom.joinBtn.addEventListener('click', () => {
    const name = dom.nameInput.value.trim();
    if (!name) return;
    if (name.length > 15) { dom.errorDiv.textContent = 'Имя слишком длинное (макс. 15 символов)'; return; }
    let userId = localStorage.getItem('userId');
    if (!userId) { userId = generateClientId(); localStorage.setItem('userId', userId); }
    socket.emit('join', { name, userId });
    if (!state.audioContext) state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    // A fresh login is a user gesture, so browsers allow the permission prompt here.
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(p => {
        updateNotificationButton();
        if (p === 'granted' && state.currentUser) subscribeToPush(socket);
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
    reportPageVisibility();
    subscribeToPush(socket);
    history.replaceState({ screen: 'chatlist' }, '');
    startLastSeenTimer();
    socket.emit('get users');
  });

  async function subscribeToPush(s, requestPermission = false) {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      updateNotificationButton();
      return;
    }
    try {
      let perm = Notification.permission;
      if (perm === 'default' && requestPermission) {
        perm = await Notification.requestPermission();
      }
      if (perm !== 'granted') {
        updateNotificationButton();
        return;
      }
      if (!state.currentUser || state.pushSubscriptionAttempted) return;
      state.pushSubscriptionAttempted = true;
      dom.notificationBtn.disabled = true;
      const publicKeyResp = await fetch('/api/vapid-public-key');
      if (!publicKeyResp.ok) throw new Error('Failed to get VAPID public key');
      const { publicKey } = await publicKeyResp.json();
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      await registration.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey)
      });
      const subscribeResp = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.currentUser.id, subscription }) });
      if (!subscribeResp.ok) throw new Error('Failed to save push subscription');
      updateNotificationButton({ subscribed: true });
    } catch (err) {
      state.pushSubscriptionAttempted = false;
      updateNotificationButton({ error: true });
      console.error('Push subscription error:', err);
    }
  }

  function startLastSeenTimer() {
    if (state.lastSeenTimer) clearInterval(state.lastSeenTimer);
    state.lastSeenTimer = setInterval(() => { buildChatList(); import('./ui.js').then(m => m.updateChatTitle()); }, 60000);
  }

  return socket;
}
