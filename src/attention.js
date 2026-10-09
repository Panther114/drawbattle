// Gets the attention of a player who is in another window: the tab title flashes until they come back.
let timer;
let original;

export const windowAway = () => document.hidden || !document.hasFocus();

export function stopFlash() {
  if (timer === undefined) return;
  clearInterval(timer);
  timer = undefined;
  document.title = original;
  window.removeEventListener('focus', onBack);
  document.removeEventListener('visibilitychange', onBack);
}

function onBack() {
  // focus moving into one of our own frames still counts as "here": ask the document after the dust settles
  setTimeout(() => {
    if (!windowAway()) stopFlash();
  }, 0);
}

export function flashTab(text) {
  if (!windowAway()) return;
  if (timer !== undefined) {
    // already flashing (e.g. two rounds went by): just keep the newest message
    document.title = text;
    return;
  }
  original = document.title;
  let on = true;
  document.title = text;
  timer = window.setInterval(() => {
    on = !on;
    document.title = on ? text : original;
  }, 900);
  window.addEventListener('focus', onBack);
  document.addEventListener('visibilitychange', onBack);
}
