// Light / dark theme. Light by default; the player's choice lives in localStorage.
import { reactive } from 'vue';
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

export function toggleTheme() {
  theme.choice = theme.dark ? 'light' : 'dark';
  storage?.setItem(KEY, theme.choice);
  applyTheme();
}

export function initTheme() {
  applyTheme();
}
