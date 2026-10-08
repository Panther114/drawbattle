// Light / dark theme. Light by default; the player's choice lives in localStorage.
import { nextTick, reactive } from 'vue';
import { safeStorage } from './storage.js';

const KEY = 'theme';
const storage = safeStorage('local');

const saved = storage?.getItem(KEY);
export const theme = reactive({
  choice: saved === 'dark' ? 'dark' : 'light',
  dark: false,
});

export function applyTheme() {
  theme.dark = theme.choice === 'dark';
  const root = document.documentElement;
  root.dataset.theme = theme.dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.dark ? '#14161f' : '#fffad4');
}

let fadeTimer;
function change() {
  theme.choice = theme.dark ? 'light' : 'dark';
  storage?.setItem(KEY, theme.choice);
  applyTheme();
}
export function toggleTheme() {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // (small screens switch at once: a cross-fade of a phone-sized page costs more than it gives)
  const wide = window.innerWidth >= 900;
  if (!reduced && wide && document.startViewTransition) {
    // the browser blends a snapshot of the old page into the new one on the GPU: smooth even on slow devices
    document.startViewTransition(async () => {
      change();
      await nextTick();
    });
    return;
  }
  if (reduced || !wide) return change();
  // older browsers: let the colours glide
  const root = document.documentElement;
  root.classList.add('theme-fade');
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => root.classList.remove('theme-fade'), 450);
  change();
}

export function initTheme() {
  applyTheme();
}
