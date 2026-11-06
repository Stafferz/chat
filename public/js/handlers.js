import { state } from './state.js';
import { dom } from './dom.js';
import { buildChatList, loadChatHistory, updateChatTitle } from './ui.js';
import { playNotificationSound, playActiveChatSound } from './sounds.js';
import { saveToStorage } from './storage.js';

function scrollToBottomAfterLayout() {
  const scroll = () => { dom.messagesDiv.scrollTop = dom.messagesDiv.scrollHeight; };
  requestAnimationFrame(() => {
    scroll();
    requestAnimationFrame(scroll);
  });
  setTimeout(scroll, 180);
}

export function initHandlers(socket) {
  socket.on('private message', (msg) => {
    const isOwn = msg.from === state.currentUser.id;
    const peerId = isOwn ? msg.to : msg.from;
    if (state.chatHistory[msg.from]) state.chatHistory[msg.from].isTyping = false;
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (!state.chatHistory[peerId]) state.chatHistory[peerId] = { messages: [], peerName: null, isTyping: false };
    const message = { id: msg.id, fromName: msg.fromName, text: msg.text, imageUrl: msg.imageUrl, fileInfo: msg.fileInfo, replyTo: msg.replyTo, isOwn, read: isOwn, time, timestamp: msg.timestamp, edited: msg.edited || false };
    state.chatHistory[peerId].messages.push(message);
    if (!isOwn) state.chatHistory[peerId].peerName = msg.fromName;
    saveToStorage();
    const isActiveChat = state.selectedChat && !state.selectedChat.isGroup && state.selectedChat.id === peerId;
    if (!isOwn) {
      if (isActiveChat) playActiveChatSound(); else playNotificationSound();
    }
    if (isActiveChat) {
      const wasAtBottom = dom.messagesDiv.scrollHeight - dom.messagesDiv.scrollTop - dom.messagesDiv.clientHeight < 80;
      loadChatHistory(state.selectedChat);
      if (!isOwn) message.read = true;
      if (isOwn || wasAtBottom) scrollToBottomAfterLayout();
    }
    buildChatList();
  });

  socket.on('group message', (msg) => {
    const isOwn = msg.from === state.currentUser.id;
    const groupId = msg.groupId;
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (!state.groupMessages[groupId]) state.groupMessages[groupId] = [];
    const message = { id: msg.id, fromName: msg.fromName, text: msg.text, fileInfo: msg.fileInfo, replyTo: msg.replyTo, isOwn, time, timestamp: msg.timestamp, edited: msg.edited || false };
    state.groupMessages[groupId].push(message);
    saveToStorage();
    const isActiveChat = state.selectedChat && state.selectedChat.isGroup && state.selectedChat.id === groupId;
    if (!isOwn) {
      if (isActiveChat) playActiveChatSound(); else playNotificationSound();
    }
    if (isActiveChat) {
      const wasAtBottom = dom.messagesDiv.scrollHeight - dom.messagesDiv.scrollTop - dom.messagesDiv.clientHeight < 80;
      loadChatHistory(state.selectedChat);
      if (isOwn || wasAtBottom) scrollToBottomAfterLayout();
    }
    buildChatList();
  });

  socket.on('message edited', ({ messageId, newText, from }) => {
    for (let peerId in state.chatHistory) {
      const msgs = state.chatHistory[peerId].messages;
      const idx = msgs.findIndex(m => m.id === messageId);
      if (idx !== -1) { msgs[idx].text = newText; msgs[idx].edited = true; break; }
    }
    saveToStorage();
    if (state.selectedChat && !state.selectedChat.isGroup && (state.selectedChat.id === from || from === state.currentUser.id)) {
      loadChatHistory(state.selectedChat);
    }
  });

  socket.on('group message edited', ({ messageId, newText, groupId, from }) => {
    const msgs = state.groupMessages[groupId];
    if (msgs) {
      const idx = msgs.findIndex(m => m.id === messageId);
      if (idx !== -1) { msgs[idx].text = newText; msgs[idx].edited = true; }
    }
    saveToStorage();
    if (state.selectedChat && state.selectedChat.isGroup && state.selectedChat.id === groupId) {
      loadChatHistory(state.selectedChat);
    }
  });

  socket.on('message deleted', ({ messageId, from }) => {
    for (let peerId in state.chatHistory) {
      const msgs = state.chatHistory[peerId].messages;
      const idx = msgs.findIndex(m => m.id === messageId);
      if (idx !== -1) { msgs.splice(idx, 1); break; }
    }
    saveToStorage();
    if (state.selectedChat && !state.selectedChat.isGroup && (state.selectedChat.id === from || from === state.currentUser.id)) {
      loadChatHistory(state.selectedChat);
    }
    buildChatList();
  });

  socket.on('group message deleted', ({ messageId, groupId, from }) => {
    const msgs = state.groupMessages[groupId];
    if (msgs) {
      const idx = msgs.findIndex(m => m.id === messageId);
      if (idx !== -1) msgs.splice(idx, 1);
    }
    saveToStorage();
    if (state.selectedChat && state.selectedChat.isGroup && state.selectedChat.id === groupId) {
      loadChatHistory(state.selectedChat);
    }
    buildChatList();
  });

  socket.on('chat cleared', ({ peerId }) => {
    if (state.chatHistory[peerId]) {
      state.chatHistory[peerId].messages = [];
      saveToStorage();
      if (state.selectedChat && !state.selectedChat.isGroup && state.selectedChat.id === peerId) dom.messagesDiv.innerHTML = '';
      buildChatList();
    }
  });

  socket.on('typing', ({ from, fromName }) => {
    if (state.chatHistory[from]) { state.chatHistory[from].isTyping = true; buildChatList(); }
    if (state.selectedChat && !state.selectedChat.isGroup && state.selectedChat.id === from) dom.typingIndicatorHeader.textContent = `${fromName} печатает...`;
  });

  socket.on('stop typing', ({ from }) => {
    if (state.chatHistory[from]) { state.chatHistory[from].isTyping = false; buildChatList(); }
    if (state.selectedChat && !state.selectedChat.isGroup && state.selectedChat.id === from) dom.typingIndicatorHeader.textContent = '';
  });

  socket.on('user list', (online) => {
    state.onlineUsers = online;
    buildChatList();
    updateChatTitle();
  });

  socket.on('last seen update', (lastSeen) => {
    state.lastSeenMap = lastSeen;
    buildChatList();
    updateChatTitle();
  });

  socket.on('kicked', (data) => {
    if (data.userId === state.currentUser?.id) { alert(data.message); location.reload(); }
  });
}
