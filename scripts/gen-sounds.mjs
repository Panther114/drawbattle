import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/assets/sounds');
fs.mkdirSync(out, { recursive: true });
const RATE = 22050;

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => buf.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767, 44 + i * 2));
  return buf;
}
// one note with attack/decay envelope
function tone(freq, dur, { type = 'sine', vol = 0.5, start = 0, decay = 5 } = {}) {
  const n = Math.floor(dur * RATE);
  const s = new Float32Array(start * RATE + n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const ph = 2 * Math.PI * freq * t;
    let v = type === 'square' ? Math.sign(Math.sin(ph)) * 0.6 : type === 'saw' ? 2 * ((freq * t) % 1) - 1 : Math.sin(ph);
    const env = Math.min(1, i / (RATE * 0.005)) * Math.exp(-decay * t / dur);
    s[start * RATE + i] = v * env * vol;
  }
  return s;
}
function mix(...parts) {
  const len = Math.max(...parts.map((p) => p.length));
  const o = new Float32Array(len);
  for (const p of parts) for (let i = 0; i < p.length; i++) o[i] += p[i];
  return o;
}
function noise(dur, vol = 0.5, decay = 8) {
  const n = Math.floor(dur * RATE);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = (Math.random() * 2 - 1) * vol * Math.exp(-decay * i / n);
  return s;
}
const sounds = {
  beep_low: tone(440, 0.15, { vol: 0.45, decay: 3 }),
  beep_high: tone(880, 0.35, { vol: 0.45, decay: 3 }),
  correct: mix(tone(660, 0.12, { vol: 0.4 }), tone(990, 0.3, { vol: 0.4, start: 0.1 })),
  other_correct: mix(tone(330, 0.12, { vol: 0.3 }), tone(300, 0.25, { vol: 0.3, start: 0.1 })),
  clock_tick: tone(1200, 0.04, { type: 'square', vol: 0.2, decay: 6 }),
  buzzer: tone(110, 0.7, { type: 'saw', vol: 0.4, decay: 1.5 }),
  score_tally: mix(...Array.from({ length: 14 }, (_, i) => tone(500 + i * 40, 0.05, { vol: 0.25, start: i * 0.05, decay: 4 }))),
  confetti_pop: mix(noise(0.25, 0.6, 10), tone(180, 0.12, { vol: 0.5, decay: 6 })),
  fanfare: mix(
    tone(523, 0.18, { type: 'square', vol: 0.25 }),
    tone(659, 0.18, { type: 'square', vol: 0.25, start: 0.16 }),
    tone(784, 0.18, { type: 'square', vol: 0.25, start: 0.32 }),
    tone(1047, 0.6, { type: 'square', vol: 0.25, start: 0.48, decay: 3 }),
  ),
};
for (const [name, s] of Object.entries(sounds)) fs.writeFileSync(path.join(out, `${name}.wav`), wav(s));
console.log(Object.keys(sounds).length, 'sounds written');
