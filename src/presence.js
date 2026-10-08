// What the other players see next to my name: 0 = here, 1 = this window is not the active one (blue icon),
// 2 = I have Quick Switch open (snooze icon). Only changes are sent, after a short settle time.
import { effectScope, ref, watch } from 'vue';
import { qs } from './quickswitch.js';

export const Presence = { Active: 0, Away: 1, Snooze: 2 };

const blurred = ref(false);
export const presence = ref(Presence.Active);

const raw = () => (qs.open ? Presence.Snooze : blurred.value ? Presence.Away : Presence.Active);
let timer;
function settle() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    presence.value = raw();
  }, 300);
}

function measure() {
  blurred.value = document.hidden || !document.hasFocus();
}

let started = false;
export function trackPresence() {
  if (started) return;
  started = true;
  measure();
  presence.value = raw();
  // focus moving into one of our own frames still counts as "here": ask the document after the dust settles
  window.addEventListener('blur', () => setTimeout(measure, 0));
  window.addEventListener('focus', measure);
  document.addEventListener('visibilitychange', measure);
  // a scope of its own: the watcher must outlive the game page that happened to start it
  effectScope(true).run(() => watch([blurred, () => qs.open], settle));
}
