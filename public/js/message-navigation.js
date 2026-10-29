// Message navigation handler - click message to scroll to it
import { state } from './state.js';
import { dom } from './dom.js';

export function initMessageNavigation() {
  if (dom.messagesDiv) {
    dom.messagesDiv.addEventListener('click', (e) => {
      const target = e.target.closest('.message');
      if (target && target.dataset.messageId) {
        // Show a subtle indication that we're jumping to that message
        target.style.outline = '2px solid #ff8c00';
        setTimeout(() => target.style.outline = '', 500);
        // Scroll to the message
        const msgTop = target.offsetTop - 20;
        dom.messagesDiv.scrollTop = msgTop;
        // Show temporary highlight effect
        target.style.backgroundColor = 'rgba(255, 140, 0, 0.2)';
        setTimeout(() => target.style.backgroundColor = '', 1500);
      }
    });
  }
}

export function setupMessageClickNavigation() {
  // Add a visual hint that messages are clickable
  if (dom.messagesDiv) {
    dom.messagesDiv.addEventListener('mouseenter', (e) => {
      const target = e.target.closest('.message');
      if (target) {
        target.style.cursor = 'pointer';
      }
    });
    dom.messagesDiv.addEventListener('mouseleave', (e) => {
      const target = e.target.closest('.message');
      if (target) {
        target.style.cursor = 'default';
      }
    });
  }
}
