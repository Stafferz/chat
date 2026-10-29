import { state } from './state.js';
import { dom } from './dom.js';
import { loadFromStorage, saveToStorage, clearStorageAndRelogin } from './storage.js';
import { initSocket } from './socket.js';
import { initHandlers } from './handlers.js';
import { initGroups } from './groups.js';
import { initUpload } from './upload.js';
import { updateCurrentUserNick, adjustMessagesHeight, updateScrollButtonPosition, closeChat, cancelReply, cancelFile } from './ui.js';
import { initMessageNavigation, setupMessageClickNavigation } from './message-navigation.js';

export function sendMessage() {
  if (!state.selectedChat) return;
  const text = dom.messageInput.value.trim();
  if (!text && !state.selectedFile && !state.isEditing) return;
  const socket = window._socket;
  if (!socket) return;

  if (state.isEditing) {
    if (state.selectedChat.isGroup) {
      socket.emit('edit group message', { messageId: state.editingMessageId, newText: text, groupId: state.selectedChat.id });
    } else {
      socket.emit('edit message', { messageId: state.editingMessageId, newText: text, peerId: state.selectedChat.id });
    }
    state.isEditing = false;
    state.editingMessageId = null;
    dom.messageInput.value = '';
    dom.messageInput.style.height = 'auto';
    cancelReply();
    setTimeout(() => dom.messageInput.focus(), 300);
    return;
  }

  if (state.selectedFile) {
    const fileToSend = state.selectedFile;
    const replyToCopy = state.replyToMessage ? { id: state.replyToMessage.id, text: state.replyToMessage.text, fromName: state.replyToMessage.fromName } : null;
    const textToSend = text;
    const targetId = state.selectedChat.id;
    const isGroup = state.selectedChat.isGroup;
    cancelReply();
    cancelFile();
    const formData = new FormData();
    formData.append('file', fileToSend);
    const originalText = dom.sendBtn.textContent;
    dom.sendBtn.textContent = '0%';
    dom.sendBtn.disabled = true;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) dom.sendBtn.textContent = Math.round((e.loaded / e.total) * 100) + '%';
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        const fileInfo = { url: data.url, mimetype: data.mimetype, originalname: data.originalname };
        if (isGroup) {
          socket.emit('group message', { groupId: targetId, text: textToSend, fileInfo: fileInfo, replyTo: replyToCopy });
        } else {
          socket.emit('private message', { to: targetId, text: textToSend, fileInfo: fileInfo, replyTo: replyToCopy });
        }
        playSelfSendSound();
      } else {
        alert('Ошибка загрузки');
      }
      dom.sendBtn.textContent = 'Отправить';
      dom.sendBtn.disabled = false;
      dom.messageInput.value = '';
      dom.messageInput.style.height = 'auto';
      setTimeout(() => { dom.messagesDiv.scrollTop = dom.messagesDiv.scrollHeight; }, 200);
      setTimeout(() => { dom.messageInput.focus(); dom.messageInput.value = ''; dom.messageInput.style.height = 'auto'; }, 300);
    };
    xhr.onerror = () => {
      alert('Ошибка сети');
      dom.sendBtn.textContent = 'Отправить';
      dom.sendBtn.disabled = false;
      setTimeout(() => dom.messageInput.focus(), 300);
    };
    xhr.send(formData);
  } else {
    const replyToCopy = state.replyToMessage ? { id: state.replyToMessage.id, text: state.replyToMessage.text, fromName: state.replyToMessage.fromName } : null;
    cancelReply();
    if (state.selectedChat.isGroup) {
      socket.emit('group message', { groupId: state.selectedChat.id, text: text, replyTo: replyToCopy });
    } else {
      socket.emit('private message', { to: state.selectedChat.id, text: text, replyTo: replyToCopy });
    }
    playSelfSendSound();
    dom.messageInput.value = '';
    dom.messageInput.style.height = 'auto';
    setTimeout(() => { dom.messagesDiv.scrollTop = dom.messagesDiv.scrollHeight; }, 200);
    setTimeout(() => { dom.messageInput.focus(); dom.messageInput.value = ''; dom.messageInput.style.height = 'auto'; }, 300);
  }
}

export function init() {
  // Load saved
  const saved = loadFromStorage();
  if (saved.hasSaved) {
    state.currentUser = { id: saved.id, name: saved.name };
    dom.nameInput.value = saved.name;
    updateCurrentUserNick();
    const savedHistory = localStorage.getItem('chatHistory');
    if (savedHistory) {
      try { state.chatHistory = JSON.parse(savedHistory); for (let p in state.chatHistory) if (state.chatHistory[p].isTyping === undefined) state.chatHistory[p].isTyping = false; } catch(e) {}
    }
    const savedGroups = localStorage.getItem('groups');
    if (savedGroups) { try { state.groups = JSON.parse(savedGroups); } catch(e) {} }
    const savedGroupMessages = localStorage.getItem('groupMessages');
    if (savedGroupMessages) { try { state.groupMessages = JSON.parse(savedGroupMessages); } catch(e) {} }
    dom.loginDiv.style.display = 'none';
    dom.chatDiv.style.display = 'flex';
  }

  const socket = initSocket();
  initHandlers(socket);
  initGroups(socket);
  initUpload(socket);
  initMessageNavigation();
  setupMessageClickNavigation();

  dom.changeNickBtn.addEventListener('click', clearStorageAndRelogin);
  dom.backBtn.addEventListener('click', closeChat);
  dom.sendBtn.addEventListener('click', () => { dom.messageInput.focus(); sendMessage(); setTimeout(() => { dom.messageInput.value = ''; dom.messageInput.style.height = 'auto'; }, 400); });
  dom.cancelReplyBtn.addEventListener('click', cancelReply);
  dom.clearChatBtn.addEventListener('click', () => {
    if (!state.selectedChat) return;
    if (confirm('Очистить всю историю?')) {
      if (state.selectedChat.isGroup) {
        state.groupMessages[state.selectedChat.id] = [];
        saveToStorage();
        dom.messagesDiv.innerHTML = '';
      } else {
        socket.emit('clear chat', { peerId: state.selectedChat.id });
      }
    }
  });

  dom.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        // Shift/Ctrl/Cmd + Enter sends the message (desktop)
        e.preventDefault();
        sendMessage();
      } else {
        // Enter alone inserts a new line (Telegram-style on mobile & desktop)
        e.preventDefault();
        const start = dom.messageInput.selectionStart;
        const end = dom.messageInput.selectionEnd;
        dom.messageInput.value = dom.messageInput.value.substring(0, start) + '\n' + dom.messageInput.value.substring(end);
        dom.messageInput.selectionStart = dom.messageInput.selectionEnd = start + 1;
        dom.messageInput.style.height = 'auto';
        dom.messageInput.style.height = dom.messageInput.scrollHeight + 'px';
        dom.messageInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }
    }
  });
  dom.messageInput.addEventListener('input', function() {
    this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px';
    if (!state.selectedChat || state.selectedChat.isGroup || !state.selectedChat.online) return;
    socket.emit('typing', { to: state.selectedChat.id });
    if (state.typingTimer) clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(() => { socket.emit('stop typing', { to: state.selectedChat.id }); }, 2000);
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => { adjustMessagesHeight(); updateScrollButtonPosition(); });
  }
  window.addEventListener('resize', () => { adjustMessagesHeight(); updateScrollButtonPosition(); if (window.innerWidth > 768) dom.chatMain.classList.remove('active'); else if (state.selectedChat) dom.chatMain.classList.add('active'); else dom.chatMain.classList.remove('active'); });
  dom.messageInput.addEventListener('focus', () => { setTimeout(() => { adjustMessagesHeight(); updateScrollButtonPosition(); }, 300); });

  // Blur keyboard when clicking in chat area (but keep when sending)
  dom.messagesDiv.addEventListener('click', () => { if (document.activeElement === dom.messageInput) { dom.messageInput.blur(); } });

  dom.scrollDownBtn.addEventListener('click', () => { dom.messagesDiv.scrollTo({ top: dom.messagesDiv.scrollHeight, behavior: 'smooth' }); });
  dom.messagesDiv.addEventListener('scroll', () => {
    const threshold = 100;
    const atBottom = dom.messagesDiv.scrollHeight - dom.messagesDiv.scrollTop - dom.messagesDiv.clientHeight < threshold;
    dom.scrollDownBtn.style.display = atBottom ? 'none' : 'flex';
  });

  window.addEventListener('popstate', (event) => {
    if (event.state && event.state.screen === 'chatlist' && state.selectedChat) closeChat();
  });

  if (saved.hasSaved && state.currentUser) {
    socket.emit('join', { name: saved.name, userId: saved.id });
    if (!state.audioContext) state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    import('./ui.js').then(m => m.buildChatList());
    import('./socket.js').then(() => { /* timer started in initSocket */ });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
