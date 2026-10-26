import { state } from './state.js';

export function loadFromStorage() {
  const savedName = localStorage.getItem('userName');
  const savedId = localStorage.getItem('userId');
  if (savedName && savedId) {
    state.currentUser = { id: savedId, name: savedName };
    return { hasSaved: true, name: savedName, id: savedId };
  }
  return { hasSaved: false };
}

export function saveToStorage() {
  if (state.currentUser) {
    localStorage.setItem('userName', state.currentUser.name);
    localStorage.setItem('userId', state.currentUser.id);
  }
  localStorage.setItem('chatHistory', JSON.stringify(state.chatHistory));
  localStorage.setItem('groups', JSON.stringify(state.groups));
  localStorage.setItem('groupMessages', JSON.stringify(state.groupMessages));
}

export function clearStorageAndRelogin() {
  localStorage.removeItem('userName');
  localStorage.removeItem('userId');
  localStorage.removeItem('chatHistory');
  localStorage.removeItem('groups');
  localStorage.removeItem('groupMessages');
  location.reload();
}
