import { state } from './state.js';
import { dom } from './dom.js';
import { saveToStorage } from './storage.js';

export function initGroups(socket) {
  dom.createGroupBtn.addEventListener('click', () => {
    dom.userSelectDiv.innerHTML = '';
    (state.allUsers || []).forEach(u => {
      if (u.id === state.currentUser?.id) return;
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = u.id;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(u.name));
      dom.userSelectDiv.appendChild(label);
    });
    dom.groupModal.classList.add('active');
  });

  dom.createGroupCancel.addEventListener('click', () => {
    dom.groupModal.classList.remove('active');
  });

  dom.createGroupConfirm.addEventListener('click', () => {
    const name = dom.groupNameInput.value.trim();
    const selectedMembers = [];
    document.querySelectorAll('#user-select input:checked').forEach(cb => {
      selectedMembers.push(cb.value);
    });
    if (selectedMembers.length === 0) {
      alert('Выберите хотя бы одного участника');
      return;
    }
    socket.emit('create group', { name: name || undefined, members: selectedMembers });
    dom.groupModal.classList.remove('active');
    dom.groupNameInput.value = '';
  });

  socket.on('users list', (users) => {
    state.allUsers = users.filter(u => u.id !== state.currentUser?.id);
  });

  socket.on('groups list', (userGroups) => {
    userGroups.forEach(g => {
      state.groups[g.id] = g;
    });
    saveToStorage();
    import('./ui.js').then(m => m.buildChatList());
  });

  socket.on('group created', (group) => {
    state.groups[group.id] = group;
    if (!state.groupMessages[group.id]) state.groupMessages[group.id] = [];
    saveToStorage();
    import('./ui.js').then(m => m.buildChatList());
  });
}
