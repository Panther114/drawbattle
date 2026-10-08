// Quick Switch: a hotkey that instantly covers the game with a page you chose: the built-in PDF (default), a local
// .html / .pdf file, or a website.
// Everything here stays in this browser: settings in localStorage, the chosen file in IndexedDB. Nothing is sent
// to the server or anywhere else; the page is just loaded by the browser like any other.
import { computed, reactive } from 'vue';
import { safeStorage } from './storage.js';

export const DEFAULT_PDF = '/quick-switch-default.pdf'; // ships with the app (public/)
const OLD_DEFAULT_URL = 'https://chat.deepseek.com/'; // earlier versions defaulted to this website
export const MAX_FILE_BYTES = 60 * 1024 * 1024;
const KEY = 'drawbattle.quickswitch.v1';
const storage = safeStorage('local');

export function defaultBinds() {
  return [
    { t: 'k', code: 'Tab', key: 'Tab', label: 'Tab' },
    { t: 'k', code: 'Backquote', key: '`', label: '`' },
    { t: 'm', button: 3, label: 'mouse back button' },
    { t: 'm', button: 4, label: 'mouse forward button' },
  ];
}

const defaults = () => ({
  enabled: true,
  mode: 'default', // 'default' (the built-in PDF) | 'file' (a local .html / .pdf) | 'site' (a website)
  url: '',
  display: 'frame', // 'frame' (covers the page) | 'popup' (a separate window sized to the screen)
  binds: defaultBinds(), // what switches: [{ t: 'k', code, key, label } | { t: 'm', button, label }]
  file: undefined, // { name, kind: 'html' | 'pdf' }
});

function load() {
  const d = defaults();
  try {
    const p = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (p && typeof p === 'object') {
      if (typeof p.enabled === 'boolean') d.enabled = p.enabled;
      if (p.mode === 'default' || p.mode === 'site' || p.mode === 'file') d.mode = p.mode;
      if (typeof p.url === 'string' && normalizeUrl(p.url)) d.url = p.url;
      // the old default website is no longer the default: those players move to the built-in PDF
      if (normalizeUrl(d.url) === OLD_DEFAULT_URL) {
        d.url = '';
        if (d.mode === 'site') d.mode = 'default';
      }
      if (p.display === 'frame' || p.display === 'popup') d.display = p.display;
      if (Array.isArray(p.binds)) d.binds = p.binds.filter(validBind).slice(0, 12);
      if (p.file && typeof p.file.name === 'string' && (p.file.kind === 'html' || p.file.kind === 'pdf')) d.file = { name: p.file.name, kind: p.file.kind };
    }
  } catch {
    // corrupt data: defaults
  }
  return d;
}

export const qs = reactive({
  ...load(),
  open: false, // the page is showing right now
  armed: false, // the app is running: hotkeys work on every page and the page is preloaded
  blobUrl: '', // object URL of the chosen local file
  popupBlocked: false,
  capturing: false, // the settings page is waiting for the next key / button press
});

function save() {
  try {
    storage?.setItem(KEY, JSON.stringify({ enabled: qs.enabled, mode: qs.mode, url: qs.url, display: qs.display, binds: qs.binds, file: qs.file }));
  } catch {
    // storage blocked: the settings last for this visit only
  }
}
export const saveSettings = save;

function validBind(b) {
  if (!b || typeof b.label !== 'string') return false;
  if (b.t === 'k') return typeof b.code === 'string' && typeof b.key === 'string';
  return b.t === 'm' && Number.isInteger(b.button) && b.button >= 1 && b.button <= 4 && b.button !== 2;
}
const sameBind = (a, b) => a.t === b.t && (a.t === 'm' ? a.button === b.button : a.code === b.code && a.key === b.key);
const KEY_NAMES = { ' ': 'Space', ArrowUp: 'Up arrow', ArrowDown: 'Down arrow', ArrowLeft: 'Left arrow', ArrowRight: 'Right arrow' };
const MOUSE_NAMES = { 1: 'middle mouse button', 3: 'mouse back button', 4: 'mouse forward button' };

// does this event press one of the chosen hotkeys? (plain keys only: no Ctrl / Alt / Meta / Shift)
function matchKey(e) {
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return false;
  return qs.binds.some((b) => b.t === 'k' && ((b.code && e.code === b.code) || (!e.code && e.key === b.key)));
}
const matchMouse = (e) => qs.binds.some((b) => b.t === 'm' && b.button === e.button);
const hasMouseBinds = () => qs.binds.some((b) => b.t === 'm');

// "chat.deepseek.com" -> "https://chat.deepseek.com/"; only http(s) addresses are allowed
export function normalizeUrl(raw) {
  if (typeof raw !== 'string') return undefined;
  let s = raw.trim();
  if (!s || /\s/.test(s)) return undefined;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname) return undefined;
    return u.href;
  } catch {
    return undefined;
  }
}

// ---- the chosen local file (IndexedDB) ----
const DB = 'drawbattle-quickswitch';
const STORE = 'files';
function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idb(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// the relay lets the hotkeys work while a local .html page has the focus (a website in a frame cannot do that)
const relay = (binds) => `<script>(function(){var B=${JSON.stringify(binds).replace(/</g, '\\u003c')};function t(){try{parent.postMessage({qs:'toggle'},'*')}catch(e){}}
addEventListener('keydown',function(e){if(e.ctrlKey||e.altKey||e.metaKey||e.shiftKey)return;var hit=B.some(function(b){return b.t==='k'&&((b.code&&e.code===b.code)||(!e.code&&e.key===b.key))});if(!hit)return;e.preventDefault();e.stopPropagation();if(!e.repeat)t()},true);
['mousedown','mouseup','auxclick'].forEach(function(n){addEventListener(n,function(e){if(!B.some(function(b){return b.t==='m'&&b.button===e.button}))return;e.preventDefault();e.stopPropagation();if(n==='mousedown')t()},true)});
})();<\/script>`;

async function buildUrl(blob, kind) {
  if (kind === 'pdf') return URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  const text = await blob.text();
  const RELAY = relay(qs.binds);
  const html = /<\/body\s*>/i.test(text) ? text.replace(/<\/body\s*>/i, () => `${RELAY}</body>`) : text + RELAY;
  return URL.createObjectURL(new Blob([html], { type: 'text/html' }));
}

async function showStoredFile() {
  if (qs.blobUrl) URL.revokeObjectURL(qs.blobUrl);
  qs.blobUrl = '';
  if (!qs.file) return;
  try {
    const rec = await idb('readonly', (s) => s.get('file'));
    if (rec?.blob && rec.kind === qs.file.kind) qs.blobUrl = await buildUrl(rec.blob, rec.kind);
  } catch {
    // IndexedDB blocked (private window): the file option just stays empty
  }
}

export async function chooseFile(file) {
  const m = /\.(html?|pdf)$/i.exec(file?.name ?? '');
  if (!m) return 'only .html and .pdf files work';
  if (file.size > MAX_FILE_BYTES) return 'that file is too big (60 MB max)';
  const kind = m[1].toLowerCase() === 'pdf' ? 'pdf' : 'html';
  try {
    await idb('readwrite', (s) => s.put({ blob: file, kind }, 'file'));
  } catch {
    return 'this browser would not store the file (private window?)';
  }
  qs.file = { name: file.name, kind };
  qs.mode = 'file';
  save();
  await showStoredFile();
  return undefined;
}

export async function clearFile() {
  qs.file = undefined;
  if (qs.mode === 'file') qs.mode = 'default';
  save();
  try {
    await idb('readwrite', (s) => s.delete('file'));
  } catch {
    // nothing stored
  }
  await showStoredFile();
}

void showStoredFile();

// address the cover frame / pop-up shows
export const qsSrc = computed(() => {
  if (!qs.enabled) return '';
  if (qs.mode === 'default') return DEFAULT_PDF;
  if (qs.mode === 'file') return qs.blobUrl;
  return normalizeUrl(qs.url) ?? '';
});
export const qsIsHtmlFile = computed(() => qs.mode === 'file' && qs.file?.kind === 'html');
// a PDF is drawn by the page itself (see PdfCover.vue), so its clicks and keys always reach the hotkeys.
// Only a website has to live in a frame, and a frame owned by another site never passes events up.
export const qsIsPdf = computed(() => qs.mode === 'default' || (qs.mode === 'file' && qs.file?.kind === 'pdf'));

// back to the built-in PDF, the default hotkeys and the in-page cover
export function restoreDefaults() {
  const d = defaults();
  qs.enabled = d.enabled;
  qs.mode = d.mode;
  qs.display = d.display;
  qs.binds = d.binds;
  saveSettings();
  void showStoredFile();
}

// ---- showing / hiding ----
let popup;
let frameEl;
let coverEl;
export const registerFrame = (el) => {
  frameEl = el;
};
export const registerCover = (el) => {
  coverEl = el;
};

export function closeQuick() {
  if (!qs.open) return;
  qs.open = false;
  if (qs.display === 'popup') {
    try {
      window.focus();
    } catch {
      // ignore
    }
  } else {
    try {
      document.activeElement?.blur?.();
    } catch {
      // ignore
    }
  }
}

function openPopup() {
  const src = qsSrc.value;
  if (!src) return false;
  if (!popup || popup.closed) {
    popup = window.open(src, 'drawbattle-quick-switch', `popup=yes,left=0,top=0,width=${screen.availWidth},height=${screen.availHeight}`);
  }
  if (!popup) {
    qs.popupBlocked = true;
    return false;
  }
  qs.popupBlocked = false;
  try {
    popup.moveTo(0, 0);
    popup.resizeTo(screen.availWidth, screen.availHeight);
  } catch {
    // some browsers refuse; the window still shows
  }
  popup.focus();
  return true;
}

export function toggleQuick() {
  if (!qs.enabled || !qsSrc.value) return;
  if (qs.open) return closeQuick();
  if (qs.display === 'popup') {
    if (openPopup()) qs.open = true;
    return;
  }
  qs.open = true;
  // keep keyboard focus on the page so the hotkey can switch back until the player clicks into the cover
  queueMicrotask(() => {
    try {
      document.activeElement?.blur?.();
      coverEl?.focus?.({ preventScroll: true });
    } catch {
      // ignore
    }
  });
}

// ---- hotkeys (every page) ----
let sideBtnAt = 0;
let sideBtn = 0;
let pressAt = 0;
function onKeyDown(e) {
  if (!qs.armed || !qs.enabled || qs.capturing || !matchKey(e)) return;
  e.preventDefault();
  e.stopPropagation();
  if (!e.repeat) toggleQuick();
}
function onMouse(e) {
  if (!qs.armed || !qs.enabled || qs.capturing || !matchMouse(e)) return;
  sideBtnAt = performance.now();
  sideBtn = e.button;
  e.preventDefault();
  e.stopPropagation();
  // pointerdown comes first and, once cancelled, the browser sends no mousedown: act on the first of the two
  if (e.type === 'pointerdown' || e.type === 'mousedown') {
    const now = performance.now();
    if (now - pressAt > 300) {
      pressAt = now;
      toggleQuick();
    }
  }
}
// some browsers still navigate on the side buttons; take that step right back
function onPopState() {
  if (!qs.armed || !hasMouseBinds() || performance.now() - sideBtnAt > 700) return;
  sideBtnAt = 0;
  history.go(sideBtn === 3 ? 1 : -1);
}
function onMessage(e) {
  if (!qs.armed || !frameEl || e.source !== frameEl.contentWindow) return;
  const d = e.data;
  if (d && d.qs === 'toggle') toggleQuick();
}
function onWindowFocus() {
  // coming back from the pop-up window
  if (qs.open && qs.display === 'popup') qs.open = false;
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', onKeyDown, { capture: true, passive: false });
  for (const n of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'auxclick', 'click']) {
    window.addEventListener(n, onMouse, { capture: true, passive: false });
  }
  window.addEventListener('popstate', onPopState, true);
  window.addEventListener('message', onMessage);
  window.addEventListener('focus', onWindowFocus);
}

// ---- choosing the hotkeys ----
let stopCapture;
// waits for the next key press or mouse button (not left / right click); Escape cancels. Resolves with the binding or undefined.
export function captureBind() {
  stopCapture?.();
  qs.capturing = true;
  return new Promise((resolve) => {
    const done = (b) => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onMouseDown, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      for (const n of ['mouseup', 'pointerup', 'auxclick', 'click']) window.removeEventListener(n, swallow, true);
      stopCapture = undefined;
      // let the matching release / click events pass before the normal hotkeys come back
      setTimeout(() => (qs.capturing = false), 350);
      resolve(b);
    };
    const swallow = (e) => {
      if (e.button === 0 || e.button === 2) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Dead', 'Process'].includes(e.key)) return;
      if (e.key === 'Escape') return done(undefined);
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return; // plain keys only: wait for a modifier-free press
      done({ t: 'k', code: e.code || '', key: e.key, label: KEY_NAMES[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key) });
    };
    const onMouseDown = (e) => {
      if (e.button === 0 || e.button === 2) return; // left and right clicks stay normal
      e.preventDefault();
      e.stopPropagation();
      if (e.button < 1 || e.button > 4 || !MOUSE_NAMES[e.button]) return;
      done({ t: 'm', button: e.button, label: MOUSE_NAMES[e.button] });
    };
    stopCapture = () => done(undefined);
    window.addEventListener('keydown', onKey, { capture: true, passive: false });
    // pointerdown arrives before mousedown (and cancelling it removes the mousedown), so listen to both
    window.addEventListener('pointerdown', onMouseDown, { capture: true, passive: false });
    window.addEventListener('mousedown', onMouseDown, { capture: true, passive: false });
    for (const n of ['mouseup', 'pointerup', 'auxclick', 'click']) window.addEventListener(n, swallow, { capture: true, passive: false });
  });
}
export function cancelCapture() {
  stopCapture?.();
}
// returns an error text, or undefined when added
export function addBind(b) {
  if (qs.binds.some((x) => sameBind(x, b))) return 'that one is already in the list';
  if (qs.binds.length >= 12) return 'that is plenty of hotkeys already';
  qs.binds.push(b);
  saveSettings();
  void showStoredFile();
  return undefined;
}
export function removeBind(i) {
  qs.binds.splice(i, 1);
  saveSettings();
  void showStoredFile();
}
export function resetBinds() {
  qs.binds = defaultBinds();
  saveSettings();
  void showStoredFile();
}

// the app calls this once: the hotkeys work on every page
// (kept as a function so it can be switched off again)
export function setArmed(on) {
  if (on) install();
  qs.armed = on;
  if (!on) closeQuick();
}
