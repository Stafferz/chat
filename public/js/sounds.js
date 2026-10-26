import { state } from './state.js';

export function playBeep(freq, gainValue, duration) {
  if (!state.audioContext) return;
  if (state.audioContext.state === 'suspended') {
    const init = function() {
      state.audioContext.resume().then(() => {
        beep(state.audioContext, freq, gainValue, duration);
        document.removeEventListener('click', init);
      });
    };
    document.addEventListener('click', init, { once: true });
  } else if (state.audioContext.state === 'running') {
    beep(state.audioContext, freq, gainValue, duration);
  }
}

function beep(ctx, freq, gainValue, duration) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.frequency.value = freq;
  gainNode.gain.value = gainValue;
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

export function playNotificationSound() { playBeep(800, 0.2, 0.1); }
export function playActiveChatSound() { playBeep(600, 0.1, 0.05); }
export function playSelfSendSound() { playBeep(600, 0.1, 0.05); }
