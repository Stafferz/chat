import { state } from './state.js';
import { dom } from './dom.js';
import { cancelReply, cancelFile } from './ui.js';
import { playSelfSendSound } from './sounds.js';

export function initUpload(socket) {
  dom.cancelFileBtn.addEventListener('click', cancelFile);

  dom.fileUpload.addEventListener('change', () => {
    if (dom.fileUpload.files.length) {
      state.selectedFile = dom.fileUpload.files[0];
      dom.fileNameSpan.textContent = state.selectedFile.name;
      const reader = new FileReader();
      reader.onload = (e) => {
        dom.fileThumb.innerHTML = '';
        if (state.selectedFile.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = e.target.result;
          img.style.maxWidth = '30px'; img.style.maxHeight = '30px'; img.style.borderRadius = '4px';
          dom.fileThumb.appendChild(img);
        } else if (state.selectedFile.type.startsWith('video/')) dom.fileThumb.textContent = '🎥';
        else dom.fileThumb.textContent = '📎';
      };
      reader.readAsDataURL(state.selectedFile);
      dom.filePreview.style.display = 'flex';
    } else {
      cancelFile();
    }
  });

  dom.messageInput.addEventListener('paste', async (e) => {
    const items = (e.clipboardData || window.clipboardData).items;
    for (let item of items) {
      if (item.type.indexOf('image') === 0) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!state.selectedChat) { alert('Сначала выберите чат'); return; }
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await fetch('/upload', { method: 'POST', body: formData });
          const data = await res.json();
          const fileInfo = { url: data.url, mimetype: data.mimetype, originalname: data.originalname };
          if (state.selectedChat.isGroup) {
            socket.emit('group message', { groupId: state.selectedChat.id, text: '', fileInfo: fileInfo, replyTo: state.replyToMessage ? { id: state.replyToMessage.id, text: state.replyToMessage.text, fromName: state.replyToMessage.fromName } : null });
          } else {
            socket.emit('private message', { to: state.selectedChat.id, text: '', fileInfo: fileInfo, replyTo: state.replyToMessage ? { id: state.replyToMessage.id, text: state.replyToMessage.text, fromName: state.replyToMessage.fromName } : null });
          }
          playSelfSendSound();
        } catch (err) {
          console.error(err);
          alert('Не удалось загрузить изображение');
        }
        break;
      }
    }
  });
}
