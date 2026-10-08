// Quick Switch: a hotkey that instantly covers the game with a page you chose (a website or a local .html / .pdf).
// Everything here stays in this browser: settings in localStorage, the chosen file in IndexedDB. Nothing is sent
// to the server or anywhere else; the page is just loaded by the browser like any other.
import { computed, reactive } from 'vue';
import { safeStorage } from './storage.js';

export const DEFAULT_URL = 'https://chat.deepseek.com';
export const MAX_FILE_BYTES = 60 * 1024 * 1024;
const KEY = 'drawbattle.quickswitch.v1';
const storage = safeStorage('local');

const defaults = () => ({
  enabled: true,
  mode: 'site', // 'site' | 'file'
  url: DEFAULT_URL,
  display: 'frame', // 'frame' (covers the page) | 'popup' (a separate window sized to the screen)
  keys: { tab: true, backquote: true, mouse: true },
  file: undefined, // { name, kind: 'html' | 'pdf' }
});

function load() {
  const d = defaults();
  try {
    const p = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (p && typeof p === 'object') {
      if (typeof p.enabled === 'boolean') d.enabled = p.enabled;
      if (p.mode === 'site' || p.mode === 'file') d.mode = p.mode;
      if (typeof p.url === 'string' && normalizeUrl(p.url)) d.url = p.url;
      if (p.display === 'frame' || p.display === 'popup') d.display = p.display;
      if (p.keys && typeof p.keys === 'object') for (const k of Object.keys(d.keys)) if (typeof p.keys[k] === 'boolean') d.keys[k] = p.keys[k];
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
  armed: false, // a game page is on screen: hotkeys work and the page is preloaded
  blobUrl: '', // object URL of the chosen local file
  popupBlocked: false,
});

function save() {
  try {
    storage?.setItem(KEY, JSON.stringify({ enabled: qs.enabled, mode: qs.mode, url: qs.url, display: qs.display, keys: qs.keys, file: qs.file }));
  } catch {
    // storage blocked: the settings last for this visit only
  }
}
export const saveSettings = save;

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
const RELAY = `<script>(function(){function t(k){try{parent.postMessage({qs:'toggle',k:k},'*')}catch(e){}}
addEventListener('keydown',function(e){if(e.ctrlKey||e.altKey||e.metaKey||e.shiftKey)return;var k=e.code==='Tab'||e.key==='Tab'?'tab':e.code==='Backquote'||e.key==='\x60'?'backquote':'';if(!k)return;e.preventDefault();e.stopPropagation();if(!e.repeat)t(k)},true);
['mousedown','mouseup','auxclick'].forEach(function(n){addEventListener(n,function(e){if(e.button!==3&&e.button!==4)return;e.preventDefault();e.stopPropagation();if(n==='mousedown')t('mouse')},true)});
})();<\/script>`;

async function buildUrl(blob, kind) {
  if (kind === 'pdf') return URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  const text = await blob.text();
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
  if (qs.mode === 'file') qs.mode = 'site';
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
  if (qs.mode === 'file') return qs.blobUrl;
  return normalizeUrl(qs.url) ?? '';
});
export const qsIsHtmlFile = computed(() => qs.mode === 'file' && qs.file?.kind === 'html');

// ---- showing / hiding ----
let popup;
let frameEl;
export const registerFrame = (el) => {
  frameEl = el;
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
      frameEl?.parentElement?.focus?.({ preventScroll: true });
    } catch {
      // ignore
    }
  });
}

// ---- hotkeys (only while a game page is showing) ----
let sideBtnAt = 0;
let sideBtn = 0;
function onKeyDown(e) {
  if (!qs.armed || !qs.enabled || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
  const k = e.code === 'Tab' || e.key === 'Tab' ? 'tab' : e.code === 'Backquote' || e.key === '`' ? 'backquote' : '';
  if (!k || !qs.keys[k]) return;
  e.preventDefault();
  e.stopPropagation();
  if (!e.repeat) toggleQuick();
}
function onMouse(e) {
  if (!qs.armed || !qs.enabled || (e.button !== 3 && e.button !== 4) || !qs.keys.mouse) return;
  sideBtnAt = performance.now();
  sideBtn = e.button;
  e.preventDefault();
  e.stopPropagation();
  if (e.type === 'mousedown') toggleQuick();
}
// some browsers still navigate on the side buttons; take that step right back
function onPopState() {
  if (!qs.armed || !qs.keys.mouse || performance.now() - sideBtnAt > 700) return;
  sideBtnAt = 0;
  history.go(sideBtn === 3 ? 1 : -1);
}
function onMessage(e) {
  if (!qs.armed || !frameEl || e.source !== frameEl.contentWindow) return;
  const d = e.data;
  if (d && d.qs === 'toggle' && qs.keys[d.k]) toggleQuick();
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

// a game page calls this on mount (true) and unmount (false)
export function setArmed(on) {
  if (on) install();
  qs.armed = on;
  if (!on) closeQuick();
}
