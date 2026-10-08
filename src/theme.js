// Light / dark theme. Follows the system until the player picks one; the choice lives in localStorage.
import { reactive } from 'vue';
import { safeStorage } from './storage.js';

const KEY = 'theme';
const storage = safeStorage('local');
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : undefined;

const saved = storage?.getItem(KEY);
export const theme = reactive({
  choice: saved === 'dark' || saved === 'light' ? saved : undefined, // undefined = follow the system
  dark: false,
});

export function applyTheme() {
  theme.dark = theme.choice !== undefined ? theme.choice === 'dark' : !!media?.matches;
  const root = document.documentElement;
  root.dataset.theme = theme.dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.dark ? '#14161f' : '#fffad4');
}

export function toggleTheme() {
  theme.choice = theme.dark ? 'light' : 'dark';
  storage?.setItem(KEY, theme.choice);
  applyTheme();
}

export function initTheme() {
  applyTheme();
  media?.addEventListener?.('change', () => {
    if (theme.choice === undefined) applyTheme();
  });
}
