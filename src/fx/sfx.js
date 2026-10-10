// Tiny synthesized sound effects for the celebration layer (no audio files to download).
// They follow the in-game sound toggle, which lives in this browser's storage.

import { isIOS } from '../shared.js';
import { safeStorage } from '../storage.js';

const local = safeStorage('local');
let ctx;

function audio() {
  if (isIOS() || local?.getItem('soundsEnabled') === '0') return undefined;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return undefined;
  }
}

// one soft enveloped note
function note(a, { freq, to, start = 0, dur = 0.12, type = 'sine', vol = 0.08 }) {
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const SOUNDS = {
  pop: (a) => note(a, { freq: 520, to: 980, dur: 0.09, type: 'triangle', vol: 0.07 }),
  boop: (a) => note(a, { freq: 340, to: 240, dur: 0.12, type: 'sine', vol: 0.07 }),
  whoosh: (a) => note(a, { freq: 180, to: 900, dur: 0.28, type: 'sawtooth', vol: 0.018 }),
  stamp: (a) => {
    note(a, { freq: 140, to: 60, dur: 0.22, type: 'sine', vol: 0.16 });
    note(a, { freq: 900, to: 300, dur: 0.06, type: 'square', vol: 0.02 });
  },
  sparkle: (a) => [1046, 1318, 1568, 2093].forEach((f, i) => note(a, { freq: f, start: i * 0.055, dur: 0.16, type: 'triangle', vol: 0.035 })),
  tick: (a) => note(a, { freq: 880, dur: 0.07, type: 'triangle', vol: 0.05 }),
  go: (a) => [784, 1046].forEach((f, i) => note(a, { freq: f, start: i * 0.08, dur: 0.22, type: 'triangle', vol: 0.06 })),
  tada: (a) => [523, 659, 784, 1046].forEach((f, i) => note(a, { freq: f, start: i * 0.09, dur: i === 3 ? 0.5 : 0.16, type: 'triangle', vol: 0.06 })),
  aww: (a) => [392, 370, 349].forEach((f, i) => note(a, { freq: f, to: f * 0.97, start: i * 0.16, dur: 0.22, type: 'sine', vol: 0.05 })),
  swap: (a) => [659, 523, 784].forEach((f, i) => note(a, { freq: f, start: i * 0.07, dur: 0.14, type: 'square', vol: 0.02 })),
};

export function sfx(name) {
  const a = audio();
  if (a && SOUNDS[name]) SOUNDS[name](a);
}
