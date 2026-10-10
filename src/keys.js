// Keyboard control for the whole app. One window listener hands every key press to the bindings that whatever is on
// screen has registered; the cheat sheet (the "?" overlay) is fed from the catalog at the bottom of this file.
//
//   useKeys([{ key: 'enter', run: (e) => ..., when: () => ..., typing: false, prio: Prio.page }], { prio, modal })
//
// - key: 'a', '/', 'enter', 'esc', 'left', 'alt+1', 'shift+2' ... or an array of those
// - run(e): do the thing. Returning false means "not mine after all": the next binding gets a go, then the browser
// - when(e): skip this binding while it returns false
// - typing: true to also fire while a text field has focus (single keys are ignored there by default)
// - the highest prio wins; among equals the binding registered last wins. A registration with { modal: true } shuts
//   every non-modal binding off while it exists (dialogs)
import { computed, getCurrentScope, onScopeDispose, reactive } from 'vue';
import { qs } from './quickswitch.js';

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
    return;
  }
}

// Esc leaves a text field, and lets go of a focused button (everything else that wants Esc outranks this)
registerKeys(
  [
    {
      key: 'esc',
      typing: true,
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
  { id: 'esc', group: 'everywhere', keys: ['Esc'], label: 'leave the box you are typing in' },
  { id: 'theme', group: 'everywhere', keys: ['T'], label: 'dark / light theme' },
  { id: 'sound', group: 'everywhere', keys: ['M'], label: 'sounds on / off (in a game)' },
  { id: 'leave', group: 'everywhere', keys: ['Q'], label: 'leave the game (asks first)' },
  { id: 'home', group: 'everywhere', keys: ['H'], label: 'back to the home page' },

  { id: 'home.new', group: 'home', keys: ['N'], label: 'new game, pick a code' },
  { id: 'home.join', group: 'home', keys: ['J'], label: 'type a game code' },
  { id: 'home.go', group: 'home', keys: ['↵'], label: 'create / join (in the code boxes)' },
  { id: 'home.preview', group: 'home', keys: ['P'], label: 'preview the word pack' },
  { id: 'home.links', group: 'home', keys: ['L', 'W'], label: 'lobbies, word pack editor' },
  { id: 'nav.links', group: 'home', keys: ['S', 'Z', 'G'], label: 'my stats, quick switch, github' },
  { id: 'lobbies.join', group: 'home', keys: ['1–9'], label: 'lobbies page: join a game' },
  { id: 'lobbies.spectate', group: 'home', keys: ['Shift+1–9'], label: 'lobbies page: spectate it' },

  { id: 'lobby.go', group: 'lobby', keys: ['↵'], label: 'join, then start the game' },
  { id: 'lobby.team', group: 'lobby', keys: ['1–2'], label: 'join a team (switch teams)' },
  { id: 'lobby.cancel', group: 'lobby', keys: ['Esc'], label: 'cancel the start countdown' },
  { id: 'lobby.name', group: 'lobby', keys: ['N'], label: 'change your name' },
  { id: 'lobby.spectate', group: 'lobby', keys: ['S'], label: 'join as a spectator' },
  { id: 'lobby.invite', group: 'lobby', keys: ['I'], label: 'copy the invite link' },
  { id: 'lobby.packs', group: 'lobby', keys: ['W'], label: 'browse word packs' },
  { id: 'lobby.rules', group: 'lobby', keys: ['U'], label: 'customize rules' },
  { id: 'lobby.rejoin', group: 'lobby', keys: ['1–9'], label: 'game in progress: rejoin as' },
  { id: 'lobby.pick', group: 'lobby', keys: ['A', 'B'], label: 'game in progress: pick a team' },

  { id: 'settings.num', group: 'lobby settings', keys: ['O', 'E'], label: 'rounds, seconds per round' },
  { id: 'settings.length', group: 'lobby settings', keys: ['L'], label: 'show word lengths' },
  { id: 'settings.final', group: 'lobby settings', keys: ['D'], label: 'final drawdown' },
  { id: 'settings.random', group: 'lobby settings', keys: ['X'], label: 'random teams' },
  { id: 'settings.head', group: 'lobby settings', keys: ['H'], label: 'head start' },
  { id: 'settings.rotate', group: 'lobby settings', keys: ['A'], label: 'drawers always rotate' },
  { id: 'settings.late', group: 'lobby settings', keys: ['J', 'K'], label: 'mid-game joins, late joiners pick' },

  { id: 'round.word', group: 'in a round', keys: ['1–4'], label: 'choose a word' },
  { id: 'round.guess', group: 'in a round', keys: ['↵'], label: 'type a guess; ↵ again sends it' },
  { id: 'round.swap', group: 'in a round', keys: ['/'], label: 'swap between guess box and chat' },
  { id: 'round.end', group: 'in a round', keys: ['V'], label: 'vote to end the game' },

  { id: 'score.ready', group: 'after a round', keys: ['↵'], label: 'ready up / take it back' },
  { id: 'score.force', group: 'after a round', keys: ['F'], label: 'start without waiting' },

  { id: 'chat.toggle', group: 'chat & players', keys: ['C'], label: 'open / close the chat' },
  { id: 'chat.focus', group: 'chat & players', keys: ['/'], label: 'write in the chat' },
  { id: 'chat.players', group: 'chat & players', keys: ['P'], label: 'players tab' },
  { id: 'chat.switch', group: 'chat & players', keys: ['S', 'Y'], label: 'ask to switch teams, agree' },
  { id: 'chat.kick', group: 'chat & players', keys: ['1–9'], label: 'votekick (players tab)' },

  { id: 'summary.back', group: 'summary', keys: ['↵'], label: 'back to the lobby' },
  { id: 'summary.words', group: 'summary', keys: ['←', '→'], label: 'previous / next word' },
  { id: 'summary.guesses', group: 'summary', keys: ['G'], label: 'show guesses' },

  { id: 'dialog.close', group: 'dialogs', keys: ['Esc'], label: 'close' },
  { id: 'dialog.ok', group: 'dialogs', keys: ['↵'], label: 'confirm' },
  { id: 'dialog.tabs', group: 'dialogs', keys: ['←', '→'], label: 'word packs: switch tab' },
  { id: 'dialog.packs', group: 'dialogs', keys: ['1–9', 'C'], label: 'word packs: pick, custom id' },
  { id: 'dialog.move', group: 'dialogs', keys: ['↑', '↓'], label: 'rules: move between rules' },
  { id: 'dialog.presets', group: 'dialogs', keys: ['1–4'], label: 'rules: presets' },

  // the reaction wheel (in a game) registers the real bindings
  { id: 'reactions.wheel', group: 'reactions', keys: ['R'], label: 'open / close the reaction wheel' },
  { id: 'reactions.pick', group: 'reactions', keys: ['1–8', '←', '→', '↵'], label: 'in the wheel: send, move, send highlighted' },
  { id: 'reactions.quick', group: 'reactions', keys: ['Alt+1–8'], label: 'send a reaction at once, even while typing' },
  { id: 'reactions.skip', group: 'reactions', keys: ['Esc', '↵'], label: 'skip the start / game over animation' },
];
const GROUP_ORDER = ['everywhere', 'home', 'lobby', 'lobby settings', 'in a round', 'after a round', 'chat & players', 'summary', 'dialogs', 'reactions'];

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
