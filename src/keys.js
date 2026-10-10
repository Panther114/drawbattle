// Keyboard control for the whole app. One window listener hands every key press to the bindings that whatever is on
// screen has registered; the cheat sheet (the "?" overlay) is fed from the catalog at the bottom of this file.
//
//   useKeys([{ key: 'enter', run: (e) => ..., when: () => ..., typing: false, prio: Prio.page }], { prio, modal })
//
// - key: 'a', '/', 'enter', 'esc', 'left', 'alt+1', 'shift+2' ... or an array of those
// - run(e): do the thing. Returning false means "not mine after all": the next binding gets a go, then the browser
// - when(e): skip this binding while it returns false
// - typing: true to also fire while a text field has focus (single keys are ignored there by default)
// - press: where the key's tile sits, so the matching control looks pressed (a selector; false for none)
// - the highest prio wins; among equals the binding registered last wins. A registration with { modal: true } shuts
//   every non-modal binding off while it exists (dialogs)
import { computed, getCurrentScope, onScopeDispose, reactive } from 'vue';
import { qs } from './quickswitch.js';
import { pressByKey } from './fx/press.js';

export const Prio = { fallback: 0, page: 10, overlay: 20, panel: 30, modal: 100 };

export const keys = reactive({ help: false });
export const toggleHelp = () => (keys.help = !keys.help);

// ---- what has focus ----
const NO_TEXT = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'];
// true while a field that swallows letters has focus
export function isTyping(el = document.activeElement) {
  if (!el || el === document.body) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  return el.tagName === 'INPUT' && !NO_TEXT.includes(el.type);
}
// a focused button / link / checkbox already answers Enter and Space itself
function isActivatable(el = document.activeElement) {
  if (!el || el === document.body) return false;
  return el.matches?.('button, a[href], summary, [role="tab"], [role="button"], input[type="checkbox"], input[type="radio"]') === true;
}

// the guess box of a round (also the final round): focused if there is one the player can type in
export function focusGuess() {
  const el = document.querySelector('.mp-guess-input');
  if (!el || el.disabled || el.offsetParent === null) return false;
  el.focus();
  return document.activeElement === el;
}

// ---- matching ----
const NAMES = { esc: 'escape', space: ' ', left: 'arrowleft', right: 'arrowright', up: 'arrowup', down: 'arrowdown', del: 'delete' };
function parse(spec) {
  const parts = spec.toLowerCase().split('+');
  const raw = parts.pop() || '+';
  const k = NAMES[raw] ?? raw;
  const alnum = /^[a-z0-9]$/.test(k);
  const s = { k, alnum, ctrl: parts.includes('ctrl'), alt: parts.includes('alt'), shift: parts.includes('shift'), meta: parts.includes('meta') };
  s.byCode = alnum && (s.alt || s.shift); // Alt+1 and Shift+2 type other characters, so go by the physical key
  return s;
}
function matches(s, e) {
  if (e.ctrlKey !== s.ctrl || e.metaKey !== s.meta || e.altKey !== s.alt) return false;
  const code = e.code ?? '';
  const phys = code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : undefined;
  let k = s.byCode ? phys : e.key.toLowerCase();
  // letters on a non-latin layout still answer to the key they sit on
  if (!s.byCode && s.alnum && k !== s.k && phys === s.k && !/^[\x00-\x7f]$/.test(e.key)) k = phys;
  if (k !== s.k) return false;
  return s.alnum || s.k.length > 1 ? e.shiftKey === s.shift : true; // symbols such as ? and / already include shift
}

// the name a key tile uses for a key press (<KeyHint k="..."> writes the same name into data-k)
const TILE_NAMES = { escape: 'esc', ' ': 'space', arrowleft: 'left', arrowright: 'right', arrowup: 'up', arrowdown: 'down' };
export function tileName(k) {
  const low = String(k).toLowerCase();
  return TILE_NAMES[low] ?? low;
}
function keyName(e) {
  const code = e.code ?? '';
  // letters by position, so a tile reads the same on any layout
  if (code.startsWith('Key') && !/^[\x00-\x7f]$/.test(e.key)) return code.slice(3).toLowerCase();
  return tileName(e.key);
}

// ---- registry ----
let seq = 0;
const regs = [];
export function registerKeys(bindings, { prio = Prio.page, modal = false } = {}) {
  const reg = {
    prio,
    modal,
    seq: ++seq,
    items: bindings.map((b, i) => ({ b, i, specs: [].concat(b.key).map(parse) })),
  };
  regs.push(reg);
  return () => {
    const at = regs.indexOf(reg);
    if (at >= 0) regs.splice(at, 1);
  };
}
// for components: unregistered again when the component goes away
export function useKeys(bindings, opts) {
  const off = registerKeys(bindings, opts);
  if (getCurrentScope()) onScopeDispose(off);
  return off;
}

const MODIFIER_KEYS = ['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Dead', 'Process'];
function onKeyDown(e) {
  if (e.defaultPrevented || e.isComposing || e.keyCode === 229 || MODIFIER_KEYS.includes(e.key)) return;
  if (qs.open || qs.capturing) return; // quick switch is showing, or a hotkey is being chosen
  const typing = isTyping();
  const activatable = isActivatable();
  const modal = regs.some((r) => r.modal);
  const found = [];
  for (const r of regs) {
    if (modal && !r.modal) continue;
    for (const it of r.items) {
      const b = it.b;
      if (!it.specs.some((s) => matches(s, e))) continue;
      if (typing && !b.typing) continue;
      if (e.repeat && !b.repeat) continue;
      if (activatable && (e.key === 'Enter' || e.key === ' ') && !b.force) continue;
      found.push({ b, prio: b.prio ?? r.prio, seq: r.seq, i: it.i });
    }
  }
  found.sort((a, b) => b.prio - a.prio || b.seq - a.seq || a.i - b.i);
  for (const f of found) {
    if (f.b.when && f.b.when(e) === false) continue;
    if (f.b.run(e) === false) continue;
    e.preventDefault();
    if (!e.ctrlKey && !e.metaKey && !e.altKey) pressByKey(keyName(e), f.b.press);
    return;
  }
}

// Esc leaves a text field, and lets go of a focused button (everything else that wants Esc outranks this)
registerKeys(
  [
    {
      key: 'esc',
      typing: true,
      press: false,
      run: () => {
        const el = document.activeElement;
        if (!el || el === document.body) return false;
        el.blur();
      },
    },
  ],
  { prio: Prio.fallback - 10 },
);

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onKeyDown);
  // a button that was clicked keeps focus; drop it so Enter / Space keep meaning "the main action", not "click that again"
  window.addEventListener(
    'click',
    (e) => {
      if (e.detail === 0 || !(e.target instanceof Element)) return;
      const el = e.target.closest('button, a, [role="tab"], input[type="checkbox"], input[type="radio"]');
      if (el) setTimeout(() => document.activeElement === el && el.blur());
    },
    true,
  );
}

// ---- the cheat sheet ----
// Other code adds its own lines with registerHelp(); an entry with an id that already exists replaces it.
//   registerHelp([{ id: 'reactions.wheel', group: 'reactions', keys: ['R'], label: 'open the reaction wheel' }])
// keys: one string per alternative; "Alt+1" becomes two keycaps, "1–4" stays one
const helpExtra = reactive({});
export function registerHelp(entries) {
  for (const e of entries) helpExtra[e.id] = e;
  return () => {
    for (const e of entries) if (helpExtra[e.id] === e) delete helpExtra[e.id];
  };
}

const CATALOG = [
  { id: 'help', group: 'everywhere', keys: ['?'], label: 'this sheet' },
  { id: 'esc', group: 'everywhere', keys: ['Esc'], label: 'close a dialog or the chat, leave a box, go back. leaving a game asks first: Esc again leaves, ↵ stays' },
  { id: 'theme', group: 'everywhere', keys: ['T'], label: 'dark / light mode' },
  { id: 'stats', group: 'everywhere', keys: ['S'], label: 'my stats' },

  { id: 'home.new', group: 'home', keys: ['N'], label: 'new game' },
  { id: 'home.join', group: 'home', keys: ['J'], label: 'type a game code' },

  { id: 'lobby.go', group: 'lobby', keys: ['↵'], label: 'join, then start the game' },
  { id: 'lobby.team', group: 'lobby', keys: ['1', '2'], label: 'join team 1 / team 2' },
  { id: 'lobby.settings', group: 'lobby', keys: ['3–8'], label: 'flip the setting with that number' },

  { id: 'round.word', group: 'playing', keys: ['1–4'], label: 'choose a word' },
  { id: 'round.guess', group: 'playing', keys: ['↵'], label: 'jump into the guess box (or the chat)' },
  { id: 'round.swap', group: 'playing', keys: ['/'], label: 'swap between guess box and chat' },
  { id: 'score.ready', group: 'playing', keys: ['↵'], label: 'after a round: ready up' },
  { id: 'summary.words', group: 'playing', keys: ['←', '→'], label: 'game recap: previous / next word' },

  // the reaction wheel (in a game) registers the real bindings
  { id: 'reactions.wheel', group: 'reactions', keys: ['R'], label: 'open / close the reaction wheel' },
  { id: 'reactions.pick', group: 'reactions', keys: ['1–8'], label: 'in the wheel: send that reaction' },
  { id: 'reactions.quick', group: 'reactions', keys: ['Alt+1–8'], label: 'send a reaction at once, even while typing' },
];
const GROUP_ORDER = ['everywhere', 'home', 'lobby', 'playing', 'reactions'];

export const helpGroups = computed(() => {
  const byId = new Map(CATALOG.map((e) => [e.id, e]));
  for (const e of Object.values(helpExtra)) byId.set(e.id, e);
  const groups = new Map();
  for (const e of byId.values()) {
    if (!groups.has(e.group)) groups.set(e.group, []);
    groups.get(e.group).push(e);
  }
  const rank = (g) => (GROUP_ORDER.includes(g) ? GROUP_ORDER.indexOf(g) : GROUP_ORDER.length);
  return [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([title, items]) => ({ title, items }));
});
