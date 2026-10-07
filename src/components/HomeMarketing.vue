<script setup>
import { onMounted, ref } from 'vue';

// a cute maple leaf: a hand-placed polygon, rounded off with Chaikin corner cutting so every edge is smooth
const HALF = [
  [96, 6],
  [110, 50],
  [144, 26],
  [128, 78],
  [186, 82],
  [148, 120],
  [160, 148],
  [108, 130],
  [96, 142],
];
function smoothLeaf() {
  let pts = [...HALF, ...HALF.slice(1, -1).reverse().map(([x, y]) => [192 - x, y])];
  for (let k = 0; k < 3; k++) {
    const next = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      next.push([0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by], [0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by]);
    }
    pts = next;
  }
  return 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z';
}

// [delay before drawing (ms), draw duration (ms)] per stroke
const TIMINGS = [
  [200, 900],
  [60, 260],
  [60, 120],
  [30, 120],
  [40, 200],
];
// the leaf outline, its stem, then a smiling face
const STROKES = [
  smoothLeaf(),
  'M96 138C96 150 95 160 93 170',
  'M80 88L80.2 88',
  'M112 88L112.2 88',
  'M85 100Q96 112 107 100',
];
const paths = STROKES.map(() => ref());
const shown = ref(-1);

onMounted(() => {
  let t = 0;
  TIMINGS.forEach(([delay, dur], i) => {
    const el = paths[i].value;
    t += delay;
    el.style.transition = `stroke-dashoffset ${dur > 500 ? 'cubic-bezier(0.515, 0.335, 0.505, 0.8)' : 'ease'} ${dur / 1000}s`;
    setTimeout(() => el.setAttribute('stroke-dashoffset', '0'), t);
    t += dur;
  });
  setTimeout(() => (shown.value = 0), 900);
  setTimeout(() => (shown.value = 1), 1700);
  setTimeout(() => (shown.value = 2), 2500);
  setTimeout(() => (shown.value = 3), 3300);
});
</script>

<template>
  <div class="hm-marketing">
    <div class="hm-container">
      <svg width="193" height="178" viewBox="0 0 193 178" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          v-for="(d, i) in STROKES"
          :key="i"
          :ref="(el) => (paths[i].value = el)"
          :d="d"
          stroke="black"
          stroke-width="4"
          stroke-linecap="round"
          stroke-linejoin="round"
          pathLength="1"
          stroke-dasharray="1"
          stroke-dashoffset="1"
        />
      </svg>
      <div class="hm-guess hm-guess1" :class="{ show: shown >= 0 }">
        <div class="hm-guess-inner"><span class="hm-guess-icon" />ivan_qmap guessed <span class="hm-wrong">taiwan</span></div>
      </div>
      <div class="hm-guess hm-guess2" :class="{ show: shown >= 1 }">
        <div class="hm-guess-inner"><span class="hm-guess-icon" />aquavision guessed <span class="hm-wrong">ganada</span></div>
      </div>
      <div class="hm-guess hm-guess3" :class="{ show: shown >= 2 }">
        <div class="hm-guess-inner"><span class="hm-guess-icon" />daniel guessed <span class="hm-wrong">51st state</span></div>
      </div>
      <div class="hm-guess hm-guess4" :class="{ show: shown >= 3 }">
        <div class="hm-guess-inner">
          <span class="hm-guess-icon right" />gavania guessed <span class="hm-right">canada</span>
        </div>
      </div>
    </div>
  </div>
</template>
