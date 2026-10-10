// Client-only celebration effects: a tiny event bus that the effect layer listens to.
// Everything here is cosmetic, so it is skipped entirely for people who prefer reduced motion.

import { reactive } from 'vue';
import { safeStorage } from '../storage.js';

const local = safeStorage('local');
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : undefined;

export const fxPrefs = reactive({
  // effects on/off (a player choice, kept in this browser)
  enabled: local?.getItem('fxEnabled') !== '0',
  reduced: media?.matches === true,
});
media?.addEventListener?.('change', (e) => {
  fxPrefs.reduced = e.matches;
});
export function setFxEnabled(on) {
  fxPrefs.enabled = on;
  local?.setItem('fxEnabled', on ? '1' : '0');
}
export const fxOn = () => fxPrefs.enabled && !fxPrefs.reduced;

const listeners = new Set();
export function onFx(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
// kinds: 'banner' {text, sub, tone, icon}, 'burst' {x, y, colors, count}, 'confetti' {side, colors},
// 'shake' {strength}, 'flash' {color}, 'ring' {x, y, color}, 'reaction' {id, name, team, from}
export function fx(kind, data = {}) {
  if (kind !== 'reaction' && !fxOn()) return;
  for (const fn of listeners) fn(kind, data);
}

// team colours used by the effects (team 1 blue, team 2 purple, like the chat names)
export const TEAM_COLORS = [
  ['#87e0ff', '#2689ac', '#c9f1ff'],
  ['#fac7ff', '#b45cc0', '#ffe3ff'],
];
export const PARTY = ['#87e0ff', '#fac7ff', '#ffe006', '#98ff87', '#ef5c3c', '#ffa620'];

// centre of an element on screen (falls back to the middle of the window)
export function centerOf(el) {
  if (!el?.getBoundingClientRect) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
