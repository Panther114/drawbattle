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
// the new theme spreads out in a circle from the toggle that was pressed (see the end of style.css)
function revealFrom(e) {
  const root = document.documentElement;
  const el = e?.currentTarget;
  const r = el instanceof Element ? el.getBoundingClientRect() : undefined;
  const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
  const y = r ? r.top + r.height / 2 : 0;
  root.style.setProperty('--vt-x', `${x}px`);
  root.style.setProperty('--vt-y', `${y}px`);
  root.style.setProperty('--vt-r', `${Math.ceil(Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)))}px`);
}

export function toggleTheme(e) {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // (small screens switch at once: a cross-fade of a phone-sized page costs more than it gives)
  const wide = window.innerWidth >= 900;
  if (!reduced && wide && document.startViewTransition) {
    // the browser swaps a snapshot of the old page for the new one on the GPU: smooth even on slow devices
    revealFrom(e);
    const vt = document.startViewTransition(async () => {
      change();
      await nextTick();
    });
    // (a skipped or aborted transition, e.g. in a hidden tab, still switches the theme: just keep its rejections quiet)
    vt.ready.catch(() => {});
    vt.finished.catch(() => {});
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
