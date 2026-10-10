// Button press feedback: a little burst of confetti, stars and hearts from every button press (mouse, touch or key),
// and the "pressed" look on the button whose key was hit. DOM + Web Animations only, a handful of short-lived nodes.
import { PARTY, fxOn } from './fx.js';

const PRESSABLE = 'button, .btn, a[href], [role="button"], [role="tab"], summary, label.chk, input[type="checkbox"], input[type="radio"]';
const MAX_LIVE = 70;
let layer;
let live = 0;

const SHAPES = ['dot', 'dot', 'star', 'heart', 'bar'];
const STAR = 'polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
const HEART = 'path("M5 9C2 7 0 5 0 3 0 1.3 1.3 0 3 0c.9 0 1.6.4 2 1 .4-.6 1.1-1 2-1 1.7 0 3 1.3 3 3 0 2-2 4-5 6z")';

function ensureLayer() {
  if (layer?.isConnected) return layer;
  layer = document.createElement('div');
  layer.className = 'press-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  return layer;
}

// a button's own colour leads the palette (transparent or white buttons fall back to the party colours)
function paletteOf(el) {
  const bg = el ? getComputedStyle(el).backgroundColor : '';
  const m = bg.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
  if (!m || (m[4] !== undefined && Number(m[4]) < 0.3)) return PARTY;
  const [r, g, b] = m.slice(1, 4).map(Number);
  if (r > 235 && g > 235 && b > 235) return PARTY;
  return [`rgb(${r},${g},${b})`, `rgb(${r},${g},${b})`, ...PARTY];
}

function spawn(x, y, palette, strength = 1) {
  if (!fxOn() || live > MAX_LIVE) return;
  const host = ensureLayer();
  const count = Math.round(9 * strength);
  // a soft ring
  const ring = document.createElement('span');
  ring.className = 'press-ring';
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  ring.style.borderColor = palette[0];
  host.appendChild(ring);
  live++;
  ring.animate([{ transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0.9 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 }], {
    duration: 420,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  }).onfinish = () => {
    ring.remove();
    live--;
  };
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    const shape = SHAPES[(Math.random() * SHAPES.length) | 0];
    const size = shape === 'bar' ? 4 : 5 + Math.random() * 5;
    p.className = `press-bit ${shape}`;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.width = `${shape === 'heart' ? 10 : size}px`;
    p.style.height = `${shape === 'bar' ? 10 : shape === 'heart' ? 9 : size}px`;
    p.style.background = palette[(Math.random() * palette.length) | 0];
    if (shape === 'star') p.style.clipPath = STAR;
    if (shape === 'heart') p.style.clipPath = HEART;
    host.appendChild(p);
    live++;
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const d = (26 + Math.random() * 26) * strength;
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d - 8;
    const spin = (Math.random() - 0.5) * 540;
    p.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.4) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.75}px), calc(-50% + ${dy * 0.75}px)) scale(1.1) rotate(${spin * 0.7}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 14}px)) scale(0.5) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 560 + Math.random() * 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    ).onfinish = () => {
      p.remove();
      live--;
    };
  }
}

const usable = (el) => el && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && el.offsetParent !== null;

// a pointer press on anything clickable
function onPointerDown(e) {
  if (e.button !== 0 || !(e.target instanceof Element)) return;
  const el = e.target.closest(PRESSABLE);
  if (!usable(el) || el.closest('.press-off')) return;
  spawn(e.clientX, e.clientY, paletteOf(el.closest('.btn') ?? el), el.closest('.btn') ? 1.15 : 0.8);
}

// a key ran a binding: press the visible control(s) that wear that key's tile.
// scope: a selector the tile must sit in (the binding's own corner of the screen), false for no feedback;
// by default the chat's tiles are left alone (its bindings say so themselves)
export function pressByKey(name, scope) {
  if (!name || scope === false) return;
  for (const tile of document.querySelectorAll(`.kh[data-k="${CSS.escape(name)}"]`)) {
    if (scope ? !tile.closest(scope) : tile.closest('.gc')) continue;
    // the tile sits in its control, or next to it (a checkbox row, the leave icon)
    const el = tile.closest(PRESSABLE) ?? tile.parentElement?.querySelector('input[type="checkbox"], button, a[href]');
    if (!usable(el)) continue;
    el.classList.remove('kp');
    void el.offsetWidth; // restart the pressed animation when the key is hit again quickly
    el.classList.add('kp');
    setTimeout(() => el.classList.remove('kp'), 170);
    const r = el.getBoundingClientRect();
    spawn(r.left + r.width / 2, r.top + r.height / 2, paletteOf(el.closest('.btn') ?? el), el.closest('.btn') ? 1.15 : 0.8);
  }
}

if (typeof window !== 'undefined') window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
