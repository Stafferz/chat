// Message navigation handler - click message to scroll to it
import { state } from './state.js';
import { dom } from './dom.js';

export function initMessageNavigation() {
  if (dom.messagesDiv) {
    dom.messagesDiv.addEventListener('click', (e) => {
      const replyContext = e.target.closest('.reply-context');
      if (replyContext && replyContext.dataset.replyToId) {
        e.stopPropagation();
        const original = dom.messagesDiv.querySelector(`[data-message-id="${replyContext.dataset.replyToId}"]`);
        if (original) {
          original.style.outline = '2px solid #ff8c00';
          setTimeout(() => original.style.outline = '', 500);
          const msgTop = original.offsetTop - 20;
          dom.messagesDiv.scrollTop = msgTop;
          original.style.backgroundColor = 'rgba(255, 140, 0, 0.2)';
          setTimeout(() => original.style.backgroundColor = '', 1500);
        }
        return;
      }
      const target = e.target.closest('.message');
      if (target && target.dataset.messageId) {
        target.style.outline = '2px solid #ff8c00';
        setTimeout(() => target.style.outline = '', 500);
        const msgTop = target.offsetTop - 20;
        dom.messagesDiv.scrollTop = msgTop;
        target.style.backgroundColor = 'rgba(255, 140, 0, 0.2)';
        setTimeout(() => target.style.backgroundColor = '', 1500);
      }
    });
  }
}

export function setupMessageClickNavigation() {
  if (dom.messagesDiv) {
    dom.messagesDiv.addEventListener('mouseenter', (e) => {
      const target = e.target.closest('.message');
      if (target) target.style.cursor = 'pointer';
    });
    dom.messagesDiv.addEventListener('mouseleave', (e) => {
      const target = e.target.closest('.message');
      if (target) target.style.cursor = 'default';
    });
  }
}
