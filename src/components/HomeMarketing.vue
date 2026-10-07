<script setup>
import { onMounted, ref } from 'vue';

// [delay before drawing (ms), draw duration (ms)] per stroke
const TIMINGS = [
  [400, 400],
  [100, 1200],
  [100, 500],
  [100, 300],
  [50, 300],
  [500, 1400],
  [100, 300],
  [100, 500],
  [100, 200],
  [100, 200],
];
// two crossed pencils, one path per stroke (the order they are drawn in)
const STROKES = [
  'M7.4 8.5L19.1 33.1L98.8 112.7',
  'M7.8 8.3L33.8 19.4L112.9 98.7',
  'M19.7 33.1L33.3 19.6',
  'M97.3 113.5L114.3 97L123 105.9L105.1 122.5Z',
  'M108.2 120.6L120.6 133.2L133.6 120.9L120.3 107.5',
  'M185.4 7.8L173.3 33.2L94.4 112.4',
  'M185.5 8.1L159.8 19.8L79.8 98.2',
  'M173.8 33.5L159.5 18.9',
  'M96.4 113.5L78.8 96.9L70.7 106.1L87.5 122.1Z',
  'M85.2 120.2L72.4 133L59.7 120.5L72.7 107.4',
];
const paths = STROKES.map(() => ref());
const shown = ref(-1);

onMounted(() => {
  let t = 0;
  TIMINGS.forEach(([delay, dur], i) => {
    const el = paths[i].value;
    t += delay;
    el.style.transition = `stroke-dashoffset ${dur > 1000 ? 'cubic-bezier(0.515, 0.335, 0.505, 0.8)' : 'ease'} ${dur / 1000}s`;
    setTimeout(() => el.setAttribute('stroke-dashoffset', '0'), t);
    t += dur;
  });
  setTimeout(() => (shown.value = 0), 1700);
  setTimeout(() => (shown.value = 1), 3200);
  setTimeout(() => (shown.value = 2), 5800);
  setTimeout(() => (shown.value = 3), 7000);
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
        <div class="hm-guess-inner"><span class="hm-guess-icon" />sean guessed <span class="hm-wrong">sword</span></div>
      </div>
      <div class="hm-guess hm-guess2" :class="{ show: shown >= 1 }">
        <div class="hm-guess-inner"><span class="hm-guess-icon" />yiwen guessed <span class="hm-wrong">pencil</span></div>
      </div>
      <div class="hm-guess hm-guess3" :class="{ show: shown >= 2 }">
        <div class="hm-guess-inner"><span class="hm-guess-icon" />rajeev guessed <span class="hm-wrong">swordfight</span></div>
      </div>
      <div class="hm-guess hm-guess4" :class="{ show: shown >= 3 }">
        <div class="hm-guess-inner">
          <span class="hm-guess-icon right" />rita guessed <span class="hm-right">draw battle!</span>
        </div>
      </div>
    </div>
  </div>
</template>
