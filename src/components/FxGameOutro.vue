<script setup>
// The "game over" cinematic: two torn paper halves slam shut, "game over!" is pencilled in,
// the winning team's trophy bounces in over spinning rays while the final score counts up,
// then the halves split apart to reveal the summary.
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { TEAM_COLORS, fx } from '../fx/fx.js';
import { sfx } from '../fx/sfx.js';
import KeyHint from './KeyHint.vue';

const props = defineProps({
  teams: { type: Array, required: true },
  totals: { type: Array, required: true },
  teamIndex: { type: Number, default: -1 }, // -1 for spectators
  endedEarly: { type: Boolean, default: false },
});
const emit = defineEmits(['reveal', 'done']);

const HOLD_MS = 3700;
const opening = ref(false);
const shown = ref([0, 0]);
const timers = [];
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
let raf;

const winner = computed(() => (props.totals[0] === props.totals[1] ? -1 : props.totals[0] > props.totals[1] ? 0 : 1));
// the winner reads first (on the left); a tie keeps the team order
const order = computed(() => (winner.value === 1 ? [1, 0] : [0, 1]));
const colors = computed(() => (winner.value === -1 ? ['#ffe006', '#ffffff', '#d0d0d0'] : TEAM_COLORS[winner.value]));
const headline = computed(() => (winner.value === -1 ? "it's a tie!" : `${props.teams[winner.value]?.name ?? 'a team'} wins!`));
const subline = computed(() => {
  if (winner.value === -1) return 'perfectly balanced. gg everyone';
  if (props.teamIndex < 0) return props.endedEarly ? 'the game was ended early' : 'what a game';
  return props.teamIndex === winner.value ? 'your team takes it! 🎉' : 'so close. gg, rematch?';
});

function countUp() {
  const start = performance.now();
  const dur = 950;
  const step = (now) => {
    const k = Math.min(1, (now - start) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    shown.value = props.totals.map((t) => Math.round(t * e));
    if (k < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

let finished = false;
function open() {
  if (finished) return;
  finished = true;
  opening.value = true;
  emit('reveal');
  sfx('whoosh');
  later(() => emit('done'), 650);
}

function onKey(e) {
  if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.stopImmediatePropagation();
    open();
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey, true);
  sfx('stamp');
  later(() => sfx('sparkle'), 520);
  later(() => {
    countUp();
    if (winner.value !== -1 && props.teamIndex >= 0 && props.teamIndex !== winner.value) sfx('aww');
    else sfx('tada');
    fx('confetti', { colors: colors.value, count: 80 });
  }, 1000);
  later(() => fx('burst', { x: window.innerWidth / 2, y: window.innerHeight * 0.42, colors: ['#ffe006', '#ffa620', '#ffffff'], shapes: ['star'], count: 50, spread: 160, velocity: 30 }), 1150);
  later(open, HOLD_MS);
});
onUnmounted(() => {
  window.removeEventListener('keydown', onKey, true);
  timers.forEach(clearTimeout);
  if (raf) cancelAnimationFrame(raf);
});
</script>

<template>
  <div class="fxo" :class="{ opening }" role="status" :aria-label="headline" :style="{ '--c0': colors[0], '--c1': colors[1] }" @click="open">
    <div class="fxo-half top">
      <svg class="fxo-tear" viewBox="0 0 1000 24" preserveAspectRatio="none">
        <path d="M0 0H1000V8L980 20 955 6 930 18 902 5 880 19 850 7 824 20 800 6 772 18 748 5 720 20 694 8 668 19 640 5 615 18 590 6 562 20 538 7 510 19 484 5 458 18 430 6 404 20 380 7 352 19 326 5 300 18 274 6 248 20 222 7 196 19 170 5 144 18 118 6 92 20 66 7 40 19 18 6 0 14z" />
      </svg>
    </div>
    <div class="fxo-half bottom">
      <svg class="fxo-tear" viewBox="0 0 1000 24" preserveAspectRatio="none">
        <path d="M0 24H1000V16L980 4 955 18 930 6 902 19 880 5 850 17 824 4 800 18 772 6 748 19 720 4 694 16 668 5 640 19 615 6 590 18 562 4 538 17 510 5 484 19 458 6 430 18 404 4 380 17 352 5 326 19 300 6 274 18 248 4 222 17 196 5 170 19 144 6 118 18 92 4 66 17 40 5 18 18 0 10z" />
      </svg>
    </div>

    <div class="fxo-content">
      <div class="fxo-rays" />
      <svg class="fxo-title" viewBox="0 0 520 110">
        <text x="260" y="80" text-anchor="middle">game over!</text>
      </svg>
      <svg class="fxo-trophy" viewBox="0 0 64 64" aria-hidden="true">
        <g stroke="#33261a" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">
          <path d="M18 8h28v14c0 9-6 16-14 16s-14-7-14-16z" fill="#ffd23f" />
          <path d="M18 12H9v4c0 6 4 10 10 10M46 12h9v4c0 6-4 10-10 10" fill="none" />
          <path d="M27 38h10l1 8H26z" fill="#ffd23f" />
          <path d="M20 46h24v8H20z" fill="#c98a3a" />
          <path d="M25 14c0 6 1 10 4 13" stroke="#fff6c2" fill="none" />
          <path d="M32 18l2 4 4.4.6-3.2 3 .8 4.4L32 28l-4 2 .8-4.4-3.2-3 4.4-.6z" fill="#ffffff" stroke-width="1.6" />
        </g>
      </svg>
      <div class="fxo-headline">{{ headline }}</div>
      <div class="fxo-score">
        <template v-for="(t, k) in order" :key="t">
          <span class="fxo-team" :class="'t' + t">
            <span class="fxo-team-name">{{ teams[t]?.name }}</span>
            <span class="fxo-points">{{ shown[t] }}</span>
          </span>
          <span v-if="k === 0" class="fxo-dash">–</span>
        </template>
      </div>
      <div class="fxo-sub">{{ subline }}</div>
      <div class="fxo-skip"><KeyHint k="enter" /> continue</div>
    </div>
  </div>
</template>
