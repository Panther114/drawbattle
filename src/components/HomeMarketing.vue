<script setup>
import { onMounted, onUnmounted, ref } from 'vue';

// a cute Canada: hand-placed outlines of the mainland and a few islands, rounded off with Chaikin corner cutting
const MAINLAND = [[15.6, 128.3], [13.5, 123.1], [10.8, 115.3], [12.4, 107.6], [11.8, 100.8], [14, 98.2], [12.7, 94.4], [13.6, 85.7], [11.4, 80.6], [8.8, 74.8], [6, 72.5], [28.3, 46.4], [32.5, 51.6], [39.1, 53.4], [44.2, 54.6], [49.5, 58.3], [53.1, 67.3], [62.4, 69.9], [70.6, 71.3], [78.9, 70.9], [83, 69.8], [83.4, 58.7], [88.1, 66.2], [94.3, 63.7], [99.6, 64.5], [101.7, 73.5], [96.6, 78.2], [96.1, 85.8], [91.5, 88.2], [85.2, 97.8], [85.5, 105.9], [88.7, 112.5], [100.3, 115], [104.9, 117], [110.6, 116.2], [112.5, 124.2], [117.7, 129.2], [120.1, 128.9], [120.7, 124.1], [118.1, 117.1], [120.3, 109.4], [116.5, 104], [114.5, 96.9], [112.2, 87.9], [120.1, 85.7], [125.9, 88.5], [128.4, 89.8], [131.9, 95.2], [135.3, 95.6], [136.1, 86.9], [137.3, 86.3], [144.3, 89.9], [149, 95.8], [154, 97.9], [163.2, 99.9], [168.3, 103.2], [164.3, 114.1], [154.7, 119.3], [150.8, 125.1], [147.4, 132.6], [148.4, 128.8], [155.6, 123.5], [157.8, 124], [156.6, 128.2], [155.6, 129.1], [159.6, 130], [161.9, 133.2], [164.4, 131.7], [171, 129.7], [172.2, 126.6], [171.6, 130.7], [167.5, 137.1], [163, 143.5], [161.4, 140.4], [163.6, 135.7], [160.3, 138.3], [158.4, 140.6], [156.2, 139.1], [153, 134.2], [149, 134.4], [148.5, 138.4], [147, 145.3], [138.8, 148.3], [135.1, 152.8], [129.3, 158.2], [119.3, 165.8], [118, 153], [111.9, 149.5], [102, 144.8], [98.2, 145.6], [85.1, 142.6]];
const VAN_ISLAND = [[14.5, 130.3], [11.1, 127.4], [7.3, 117.7], [9.7, 117.3], [14.1, 121.7], [15, 126.7]];
const NEWFOUNDLAND = [[170.9, 121.1], [178.3, 116.9], [187, 114.1], [184.6, 111.6], [178.7, 107.1], [170.1, 103.7], [168.7, 109.8], [169.4, 118.4]];
const BAFFIN = [[109.7, 80.6], [120.1, 83.3], [130.4, 76.1], [129.3, 64.5], [119.1, 57.5], [109.6, 54.5], [99.5, 49.2], [90, 50], [89.9, 58.6], [97.9, 62.2], [105.4, 61.1], [113, 67], [112.3, 73.6]];
const VICTORIA = [[55.5, 53.2], [62.3, 50.7], [70.5, 54.5], [74.2, 62.4], [69.8, 67.5], [61.5, 67.8], [54.9, 62]];
const ELLESMERE = [[84.9, 36.4], [95.8, 39.3], [97.3, 32.1], [99, 18.1], [93.8, 12.2], [86.8, 16.7], [82.3, 25]];
const BANKS = [[49.4, 49.7], [57.9, 44.1], [59.1, 49.7], [53.6, 54.8]];
function smooth(pts, k = 3) {
  for (let n = 0; n < k; n++) {
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
  [200, 1100],
  [60, 150],
  [40, 150],
  [40, 200],
  [40, 120],
  [40, 120],
  [40, 100],
];
// the mainland, then the islands, in drawing order
const STROKES = [
  smooth(MAINLAND, 3),
  smooth(VAN_ISLAND, 2),
  smooth(NEWFOUNDLAND, 2),
  smooth(BAFFIN, 2),
  smooth(VICTORIA, 2),
  smooth(ELLESMERE, 2),
  smooth(BANKS, 2),
];
const paths = STROKES.map(() => ref());
const shown = ref(-1);
const timers = [];
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
onUnmounted(() => timers.forEach(clearTimeout));

onMounted(() => {
  let t = 0;
  TIMINGS.forEach(([delay, dur], i) => {
    const el = paths[i].value;
    t += delay;
    el.style.transition = `stroke-dashoffset ${dur > 500 ? 'cubic-bezier(0.515, 0.335, 0.505, 0.8)' : 'ease'} ${dur / 1000}s`;
    later(() => el.setAttribute('stroke-dashoffset', '0'), t);
    t += dur;
  });
  later(() => (shown.value = 0), 900);
  later(() => (shown.value = 1), 1700);
  later(() => (shown.value = 2), 2500);
  later(() => (shown.value = 3), 3300);
});
</script>

<template>
  <div class="hm-marketing">
    <div class="hm-container">
      <svg width="346" height="318" viewBox="0 0 193 178" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          v-for="(d, i) in STROKES"
          :key="i"
          :ref="(el) => (paths[i].value = el)"
          :d="d"
          stroke="currentColor"
          stroke-width="3"
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
        <div class="hm-guess-inner"><span class="hm-guess-icon" />daniel guessed <span class="hm-wrong">51 st state</span></div>
      </div>
      <div class="hm-guess hm-guess4" :class="{ show: shown >= 3 }">
        <div class="hm-guess-inner">
          <span class="hm-guess-icon right" />gavania guessed <span class="hm-right">canada</span>
        </div>
      </div>
    </div>
  </div>
</template>
