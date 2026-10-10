<script setup>
// Original hand-drawn reaction stickers (64x64), one doodle per quick reaction.
defineProps({ id: { type: String, required: true } });

const FACE = 'M32 7.5c13.6-.3 24.6 10.6 24.5 24.6-.1 13.4-10.9 24.4-24.6 24.4C18.3 56.6 7.4 45.8 7.5 32.2 7.6 18.4 18.5 7.8 32 7.5z';
// a five point star centred on (cx, cy)
function star(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}z`;
}
const HEART = (cx, cy, s) =>
  `M${cx} ${cy + 3.6 * s}c-1.2-1-4.6-3.4-4.6-6 0-1.6 1.2-2.8 2.6-2.8 1 0 1.6.5 2 1.2.4-.7 1-1.2 2-1.2 1.4 0 2.6 1.2 2.6 2.8 0 2.6-3.4 5-4.6 6z`;
</script>

<template>
  <svg class="rx-face" viewBox="0 0 64 64" aria-hidden="true">
    <g stroke="#33261a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <!-- good job: star eyes and a big grin -->
      <template v-if="id === 'nice'">
        <path :d="FACE" fill="#ffe27a" />
        <path :d="star(23.5, 27, 6)" fill="#ffb020" stroke-width="2" />
        <path :d="star(40.5, 27, 6)" fill="#ffb020" stroke-width="2" />
        <path d="M21 37.5c3.2 9 18.8 9 22 0-7 1.6-15 1.6-22 0z" fill="#7a2e1f" />
        <path d="M27 43.6c2.8 1.4 7.2 1.4 10 0" stroke="#ff8a8a" stroke-width="2.2" />
        <path d="M55 9.5v6M52 12.5h6M8 47v4M6 49h4" stroke="#ffb020" stroke-width="2.2" />
      </template>
      <!-- my bad: squeezed eyes, wobbly mouth, sweat drop -->
      <template v-else-if="id === 'oops'">
        <path :d="FACE" fill="#ffe27a" />
        <path d="M19 24.5l6 3-6 3M45 24.5l-6 3 6 3" fill="none" />
        <path d="M23 42c2-2.4 4-2.4 6 0s4 2.4 6 0 4-2.4 6 0" fill="none" />
        <ellipse cx="17" cy="36" rx="3.6" ry="2.2" fill="#ff9aa8" stroke="none" />
        <ellipse cx="47" cy="36" rx="3.6" ry="2.2" fill="#ff9aa8" stroke="none" />
        <path d="M50 10c3 4.5 4.4 7 4.4 9a4.4 4.4 0 01-8.8 0c0-2 1.4-4.5 4.4-9z" fill="#8fd9ff" stroke-width="2" />
      </template>
      <!-- ???: one spiral eye, tilted mouth, question marks -->
      <template v-else-if="id === 'huh'">
        <path :d="FACE" fill="#ffe27a" />
        <circle cx="23" cy="28" r="2.6" fill="#33261a" />
        <path d="M41 28.2a1.4 1.4 0 11-1.4-1.6 3 3 0 013.2 3 4.6 4.6 0 01-4.6 4.4 6 6 0 01-6-6" fill="none" stroke-width="2.2" />
        <path d="M17.5 21.5l9-2.5" fill="none" />
        <path d="M24 43.5c4-1.6 9-1.8 15 .6" fill="none" />
        <text x="49" y="15" class="rx-q" fill="#2689ac" stroke="none" transform="rotate(14 49 15)">?</text>
        <text x="57" y="27" class="rx-q small" fill="#ef5c3c" stroke="none" transform="rotate(-10 57 27)">?</text>
        <text x="4" y="18" class="rx-q small" fill="#9905b1" stroke="none" transform="rotate(-18 4 18)">?</text>
      </template>
      <!-- gg: a speech bubble with a heart -->
      <template v-else-if="id === 'gg'">
        <path d="M10 13.5c13-4 32-4.2 44 0 3.6 6.4 3.8 20.4 0 27-7.6 2.4-17 3-26 2.4L16 53l2.4-10.6c-3.4-.4-6.2-1-8.4-1.8-3.6-7-3.6-20.4 0-27.1z" fill="#ffffff" />
        <text x="32" y="36.5" text-anchor="middle" class="rx-gg" fill="#2689ac" stroke="none">gg</text>
        <path :d="HEART(51, 47, 1.2)" fill="#ef5c3c" stroke-width="2" />
        <path d="M5 8l3 2.6M59 6.5l-2.6 3" stroke="#ffb020" />
      </template>
      <!-- haha: closed laughing eyes and tears -->
      <template v-else-if="id === 'haha'">
        <path :d="FACE" fill="#ffe27a" />
        <path d="M17.5 27.5c2.4-3.6 6.6-3.6 9 0M37.5 27.5c2.4-3.6 6.6-3.6 9 0" fill="none" />
        <path d="M19.5 36c3 11.6 22 11.6 25 0z" fill="#7a2e1f" />
        <path d="M25 43.4c4 2.6 10 2.6 14 0" stroke="#ff8a8a" stroke-width="2.2" />
        <path d="M12 31c-2.4 3-3.6 5-3.6 6.6a3 3 0 006 0c0-1.6-1-3.6-2.4-6.6zM52 31c-1.4 3-2.4 5-2.4 6.6a3 3 0 006 0c0-1.6-1.2-3.6-3.6-6.6z" fill="#8fd9ff" stroke-width="1.8" />
      </template>
      <!-- so close!: gritted teeth and a pinch -->
      <template v-else-if="id === 'close'">
        <path :d="FACE" fill="#ffe27a" />
        <path d="M18 21l8 2.4M46 21l-8 2.4" fill="none" />
        <circle cx="23" cy="29" r="2.6" fill="#33261a" />
        <circle cx="41" cy="29" r="2.6" fill="#33261a" />
        <rect x="20" y="37" width="24" height="9" rx="3.6" fill="#ffffff" />
        <path d="M26 37v9M32 37v9M38 37v9M20 41.5h24" stroke-width="1.6" />
        <path d="M50 4.5l2 7.4M58.5 8l-5.2 5.4" stroke="#ef5c3c" stroke-width="2.4" />
      </template>
      <!-- love it: heart eyes -->
      <template v-else-if="id === 'love'">
        <path :d="FACE" fill="#ffe27a" />
        <path :d="HEART(23.5, 25, 1.25)" fill="#ef5c3c" stroke-width="2" />
        <path :d="HEART(40.5, 25, 1.25)" fill="#ef5c3c" stroke-width="2" />
        <path d="M22 38.5c3.4 6.6 16.6 6.6 20 0" fill="none" />
        <ellipse cx="16.5" cy="37" rx="3.4" ry="2" fill="#ff9aa8" stroke="none" />
        <ellipse cx="47.5" cy="37" rx="3.4" ry="2" fill="#ff9aa8" stroke="none" />
        <path :d="HEART(55, 9, 0.9)" fill="#ff9aa8" stroke-width="1.6" />
      </template>
      <!-- hurry!: wide eyes, speed lines, a little clock -->
      <template v-else-if="id === 'hurry'">
        <path :d="FACE" fill="#ffe27a" />
        <circle cx="23" cy="27" r="5" fill="#ffffff" />
        <circle cx="41" cy="27" r="5" fill="#ffffff" />
        <circle cx="24" cy="27.6" r="2" fill="#33261a" stroke="none" />
        <circle cx="42" cy="27.6" r="2" fill="#33261a" stroke="none" />
        <ellipse cx="32" cy="42" rx="4" ry="5" fill="#7a2e1f" />
        <path d="M2 24h6M1 32h5M3 40h6" stroke="#2689ac" stroke-width="2.2" />
        <circle cx="52" cy="12" r="8" fill="#ffffff" stroke-width="2.2" />
        <path d="M52 7.6V12l3 2" stroke-width="2" />
      </template>
    </g>
  </svg>
</template>
