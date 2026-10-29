import { state } from './state.js';
import { dom } from './dom.js';
import { formatLastSeen } from './utils.js';
import { linkify } from './utils.js';

export function updateCurrentUserNick() {
  if (state.currentUser) {
    dom.currentUserNickSpan.textContent = state.currentUser.name;
  } else {
    dom.currentUserNickSpan.textContent = '';
  }
}

export function adjustMessagesHeight() {
  if (!state.selectedChat) return;
  // На мобильных высота #chat синхронизируется с visualViewport,
  // а сообщения занимают свободное место через flex.
  if (window.innerWidth <= 768) {
    dom.messagesDiv.style.height = '';
    dom.messagesDiv.style.minHeight = '0';
    return;
  }
  const header = document.getElementById('chat-header');
  const inputArea = document.querySelector('.input-area');
  if (!header || !inputArea) return;
  const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const headerHeight = header.getBoundingClientRect().height;
  const inputHeight = inputArea.getBoundingClientRect().height;
  const availableHeight = viewportHeight - headerHeight - inputHeight;
  dom.messagesDiv.style.height = availableHeight > 0 ? availableHeight + 'px' : '100px';
}

export function updateScrollButtonPosition() {
  if (!state.selectedChat) return;
  const inputArea = document.querySelector('.input-area');
  if (!inputArea) return;
  const inputRect = inputArea.getBoundingClientRect();
  const mainRect = document.querySelector('.main').getBoundingClientRect();
  const bottom = mainRect.bottom - inputRect.top + 10;
  dom.scrollDownBtn.style.bottom = bottom + 'px';
}

export function updateChatTitle() {
  if (!state.selectedChat) return;
  const isOnline = state.onlineUsers && state.onlineUsers.some(u => u.id === state.selectedChat.id);
  if (isOnline) {
    if (dom.chatStatus) { dom.chatStatus.style.display = 'inline-block'; dom.chatStatus.classList.remove('status-offline'); dom.chatStatus.classList.add('status-online'); }
  } else {
    if (dom.chatStatus) { dom.chatStatus.style.display = 'none'; dom.chatStatus.classList.remove('status-online'); dom.chatStatus.classList.add('status-offline'); }
  }
  if (state.selectedChat.isGroup) {
    dom.chatTitle.textContent = state.selectedChat.name;
    dom.chatSubtitle.textContent = `${(state.selectedChat.members||[]).length} участников`;
  } else {
    const isOnline = state.onlineUsers.some(u => u.id === state.selectedChat.id);
    if (isOnline) {
      dom.chatTitle.textContent = `Чат с ${state.selectedChat.name}`;
      dom.chatSubtitle.textContent = '';
    } else {
      const last = state.lastSeenMap[state.selectedChat.id];
      dom.chatTitle.textContent = `Чат с ${state.selectedChat.name}`;
      dom.chatSubtitle.textContent = last ? `был(а) ${formatLastSeen(last)}` : 'офлайн';
    }
  }
}

export function buildChatList() {
  const allChats = [];
  state.onlineUsers.filter(u => u.id !== state.currentUser?.id).forEach(u => allChats.push({ id: u.id, name: u.name, online: true, isGroup: false }));
  Object.keys(state.chatHistory).forEach(peerId => {
    if (peerId !== state.currentUser?.id && !state.onlineUsers.some(u => u.id === peerId)) {
      allChats.push({ id: peerId, name: state.chatHistory[peerId].peerName || 'Неизвестно', online: false, isGroup: false });
    }
  });
  Object.values(state.groups).forEach(g => {
    if (g.members && g.members.includes(state.currentUser?.id)) {
      allChats.push({ id: g.id, name: g.name, online: true, isGroup: true, members: g.members });
    }
  });
  const unique = Array.from(new Map(allChats.map(item => [item.id, item])).values());
  renderChatList(unique);
}

export function renderChatList(chats) {
  dom.chatListEl.innerHTML = '';
  chats.forEach(chat => {
    const li = document.createElement('li');
    li.dataset.id = chat.id;

    const chatItemDiv = document.createElement('div');
    chatItemDiv.className = 'chat-item' + (chat.isGroup ? ' group' : '');
    const statusSpan = document.createElement('span');
    if (!chat.isGroup) {
      statusSpan.className = `status-indicator ${chat.online ? 'status-online' : 'status-offline'}`;
    } else {
      statusSpan.className = 'status-indicator status-online';
    }
    const nameSpan = document.createElement('span');
    nameSpan.className = 'chat-name';
    nameSpan.textContent = chat.name;
    chatItemDiv.appendChild(statusSpan);
    chatItemDiv.appendChild(nameSpan);
    if (!chat.isGroup && !chat.online && state.lastSeenMap[chat.id]) {
      const lastSeenSpan = document.createElement('span');
      lastSeenSpan.className = 'chat-last-seen';
      lastSeenSpan.textContent = formatLastSeen(state.lastSeenMap[chat.id]);
      chatItemDiv.appendChild(lastSeenSpan);
    }
    if (!chat.isGroup && chat.online && state.chatHistory[chat.id]?.isTyping) {
      const typingSpan = document.createElement('span');
      typingSpan.className = 'typing-indicator-chat';
      typingSpan.textContent = '✏️';
      chatItemDiv.appendChild(typingSpan);
    }
    li.appendChild(chatItemDiv);

    if (!chat.isGroup) {
      const history = state.chatHistory[chat.id]?.messages || [];
      const unreadCount = history.filter(msg => !msg.isOwn && !msg.read).length;
      if (unreadCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'notification-badge';
        badge.textContent = unreadCount;
        li.appendChild(badge);
      }
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-chat-btn';
    deleteBtn.textContent = '❌';
    deleteBtn.title = 'Удалить чат';
    deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteChat(chat.id, chat.isGroup); });
    li.appendChild(deleteBtn);

    if (state.selectedChat && state.selectedChat.id === chat.id) li.classList.add('selected');
    li.addEventListener('click', () => selectChat(chat));
    dom.chatListEl.appendChild(li);
  });
}

export function deleteChat(chatId, isGroup) {
  if (!confirm(`Удалить историю переписки?`)) return;
  if (isGroup) {
    delete state.groups[chatId];
    delete state.groupMessages[chatId];
  } else {
    delete state.chatHistory[chatId];
  }
  import('./storage.js').then(m => m.saveToStorage());
  if (state.selectedChat && state.selectedChat.id === chatId) closeChat();
  buildChatList();
}

export function selectChat(chat) {
  state.selectedChat = chat;
  updateChatTitle();
  dom.typingIndicatorHeader.textContent = '';
  dom.messageInput.disabled = false;
  dom.sendBtn.disabled = false;
  if (!chat.isGroup) {
    if (!state.chatHistory[chat.id]) {
      state.chatHistory[chat.id] = { messages: [], peerName: chat.name, isTyping: false };
    } else {
      state.chatHistory[chat.id].peerName = chat.name;
    }
    state.chatHistory[chat.id].messages.forEach(msg => msg.read = true);
  } else {
    if (!state.groupMessages[chat.id]) state.groupMessages[chat.id] = [];
  }
  dom.clearChatBtn.style.display = 'inline-block';
  dom.messageInput.focus();
  buildChatList();
  loadChatHistory(chat);
  import('./storage.js').then(m => m.saveToStorage());
  if (window.innerWidth <= 768) {
    dom.chatMain.classList.add('active');
    history.pushState({ screen: 'chat', chatId: chat.id }, '', `#chat/${chat.id}`);
  }
  setTimeout(() => {
    adjustMessagesHeight();
    updateScrollButtonPosition();
    dom.messagesDiv.scrollTop = dom.messagesDiv.scrollHeight;
    setTimeout(() => dom.messagesDiv.scrollTop = dom.messagesDiv.scrollHeight, 200);
  }, 100);
}

export function loadChatHistory(chat) {
  dom.messagesDiv.innerHTML = '';
  let history = [];
  if (chat.isGroup) {
    history = state.groupMessages[chat.id] || [];
  } else {
    history = state.chatHistory[chat.id]?.messages || [];
  }
  let lastDate = null;
  history.forEach(msg => {
    const msgDate = new Date(msg.timestamp).toDateString();
    if (msgDate !== lastDate) {
      lastDate = msgDate;
      const separator = document.createElement('div');
      separator.className = 'date-separator';
      const span = document.createElement('span');
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (msgDate === today) span.textContent = 'Сегодня';
      else if (msgDate === yesterday) span.textContent = 'Вчера';
      else span.textContent = new Date(msg.timestamp).toLocaleDateString();
      separator.appendChild(span);
      dom.messagesDiv.appendChild(separator);
    }
    displayMessage(msg, chat.isGroup);
  });
  checkScroll();
}

export function closeChat() {
  state.selectedChat = null;
  dom.chatTitle.textContent = 'Выберите собеседника';
  dom.chatSubtitle.textContent = '';
  dom.typingIndicatorHeader.textContent = '';
  dom.messageInput.disabled = true;
  dom.sendBtn.disabled = true;
  dom.clearChatBtn.style.display = 'none';
  dom.messagesDiv.innerHTML = '';
  cancelReply();
  cancelFile();
  buildChatList();
  dom.chatListEl.scrollTop = 0;
  if (window.innerWidth <= 768) {
    dom.chatMain.classList.remove('active');
    history.pushState({ screen: 'chatlist' }, '', '#');
  }
}

export function cancelReply() {
  state.replyToMessage = null;
  dom.replyPreview.style.display = 'none';
  dom.replyTextSpan.textContent = '';
}

export function cancelFile() {
  state.selectedFile = null;
  dom.fileUpload.value = '';
  dom.filePreview.style.display = 'none';
  if (dom.fileThumb) dom.fileThumb.innerHTML = '';
}

export function replyToMsg(msg) {
  state.replyToMessage = {
    id: msg.id,
    text: msg.text || (msg.fileInfo ? msg.fileInfo.originalname : (msg.imageUrl ? 'Медиа' : '')),
    fromName: msg.fromName
  };
  dom.replyTextSpan.textContent = `Ответ ${msg.isOwn ? 'себе' : state.replyToMessage.fromName}: ${state.replyToMessage.text.substring(0, 30)}${state.replyToMessage.text.length > 30 ? '…' : ''}`;
  dom.replyPreview.style.display = 'flex';
  setTimeout(() => dom.messageInput.focus(), 500);
}

export function startEdit(messageId, currentText) {
  state.isEditing = true;
  state.editingMessageId = messageId;
  dom.messageInput.value = currentText || '';
  dom.messageInput.style.height = 'auto';
  dom.messageInput.style.height = dom.messageInput.scrollHeight + 'px';
  dom.messageInput.focus();
}

export function deleteMessage(messageId, isGroup, chatId) {
  if (!confirm('Удалить сообщение?')) return;
  const socket = window._socket;
  if (!socket) return;
  if (isGroup) {
    socket.emit('delete group message', { messageId, groupId: chatId });
  } else {
    socket.emit('delete message', { messageId, peerId: chatId });
  }
}

export function displayMessage(msg, isGroup) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${msg.isOwn ? 'own' : 'other'}`;
  messageDiv.dataset.messageId = msg.id;

  if (msg.isOwn) {
    const replyBtn = document.createElement('button');
    replyBtn.className = 'own-reply-btn'; replyBtn.textContent = '↩️'; replyBtn.title = 'Ответить';
    replyBtn.addEventListener('click', (e) => { e.stopPropagation(); replyToMsg(msg); setTimeout(() => dom.messageInput.focus(), 50); });
    messageDiv.appendChild(replyBtn);

    const editDeleteDiv = document.createElement('div');
    editDeleteDiv.className = 'own-edit-delete';
    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️'; editBtn.title = 'Редактировать';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startEdit(msg.id, msg.text || '');
    });
    editDeleteDiv.appendChild(editBtn);
    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️'; delBtn.title = 'Удалить';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteMessage(msg.id, isGroup, isGroup ? state.selectedChat.id : state.selectedChat.id);
    });
    editDeleteDiv.appendChild(delBtn);
    messageDiv.appendChild(editDeleteDiv);
  } else {
    const replyBtn = document.createElement('button');
    replyBtn.className = 'other-reply-btn'; replyBtn.textContent = '↩️'; replyBtn.title = 'Ответить';
    replyBtn.addEventListener('click', (e) => { e.stopPropagation(); replyToMsg(msg); setTimeout(() => dom.messageInput.focus(), 50); });
    messageDiv.appendChild(replyBtn);
  }

  if (msg.replyTo) {
    const replyDiv = document.createElement('div');
    replyDiv.className = 'reply-context';
    replyDiv.dataset.replyToId = msg.replyTo.id;
    const replyText = msg.replyTo.text || '...';
    replyDiv.textContent = `↩️ ${msg.replyTo.fromName}: ${replyText.substring(0, 30)}${replyText.length > 30 ? '…' : ''}`;
    messageDiv.appendChild(replyDiv);
  }

  if (isGroup && !msg.isOwn) {
    const nameSpan = document.createElement('div');
    nameSpan.className = 'sender';
    nameSpan.textContent = msg.fromName;
    messageDiv.appendChild(nameSpan);
  }
  if (!isGroup && !msg.isOwn) {
    const nameSpan = document.createElement('div');
    nameSpan.className = 'sender';
    nameSpan.textContent = msg.fromName;
    messageDiv.appendChild(nameSpan);
  }

  if (msg.text) {
    const textSpan = document.createElement('div');
    textSpan.className = 'message-text';
    textSpan.innerHTML = linkify(msg.text);
    messageDiv.appendChild(textSpan);
  }

  if (msg.fileInfo) {
    const mime = msg.fileInfo.mimetype;
    if (mime.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = msg.fileInfo.url; img.alt = msg.fileInfo.originalname;
      img.addEventListener('click', () => window.open(msg.fileInfo.url));
      messageDiv.appendChild(img);
    } else if (mime.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = msg.fileInfo.url; video.controls = true;
      video.style.maxWidth = '100%'; video.style.maxHeight = '180px';
      video.addEventListener('click', (e) => { e.stopPropagation(); window.open(msg.fileInfo.url); });
      messageDiv.appendChild(video);
    } else {
      const a = document.createElement('a');
      a.href = msg.fileInfo.url; a.download = msg.fileInfo.originalname;
      a.className = 'file-attachment';
      a.innerHTML = `📎 <span>${msg.fileInfo.originalname}</span>`;
      messageDiv.appendChild(a);
    }
  } else if (msg.imageUrl) {
    if (/\.(mp4|webm|ogg|mov|avi)$/i.test(msg.imageUrl)) {
      const video = document.createElement('video');
      video.src = msg.imageUrl; video.controls = true;
      video.style.maxWidth = '100%'; video.style.maxHeight = '180px';
      video.addEventListener('click', () => window.open(msg.imageUrl));
      messageDiv.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = msg.imageUrl;
      img.addEventListener('click', () => window.open(msg.imageUrl));
      messageDiv.appendChild(img);
    }
  }

  const timeSpan = document.createElement('div');
  timeSpan.className = 'time';
  timeSpan.textContent = msg.time + (msg.edited ? ' (ред.)' : '');
  messageDiv.appendChild(timeSpan);

  dom.messagesDiv.appendChild(messageDiv);
}

export function checkScroll() {
  const threshold = 100;
  const atBottom = dom.messagesDiv.scrollHeight - dom.messagesDiv.scrollTop - dom.messagesDiv.clientHeight < threshold;
  dom.scrollDownBtn.style.display = atBottom ? 'none' : 'flex';
}
