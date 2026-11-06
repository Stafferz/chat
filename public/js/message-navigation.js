// Message navigation handler - click message to scroll to it
import { state } from './state.js';
import { dom } from './dom.js';

function highlightAndCenterMessage(message) {
  const containerRect = dom.messagesDiv.getBoundingClientRect();
  const messageRect = message.getBoundingClientRect();
  const messageCenter = dom.messagesDiv.scrollTop
    + (messageRect.top - containerRect.top)
    + (messageRect.height / 2);

  // Keep the referenced message a little above the visual center of the chat.
  const targetScrollTop = messageCenter - (dom.messagesDiv.clientHeight * 0.42);
  dom.messagesDiv.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });

  message.style.outline = '2px solid #ff8c00';
  message.style.backgroundColor = 'rgba(255, 140, 0, 0.2)';
  setTimeout(() => { message.style.outline = ''; }, 500);
  setTimeout(() => { message.style.backgroundColor = ''; }, 1500);
}

export function initMessageNavigation() {
  if (dom.messagesDiv) {
    dom.messagesDiv.addEventListener('click', (e) => {
      const replyContext = e.target.closest('.reply-context');
      if (replyContext && replyContext.dataset.replyToId) {
        e.stopPropagation();
        const original = dom.messagesDiv.querySelector(`[data-message-id="${replyContext.dataset.replyToId}"]`);
        if (original) {
          highlightAndCenterMessage(original);
        }
        return;
      }
      const target = e.target.closest('.message');
      if (target && target.dataset.messageId) {
        highlightAndCenterMessage(target);
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
