<script setup>
// The "game is starting" cinematic: notebook paper irises in, both teams swoop in, a VS stamp lands,
// the title is pencilled in, and the lobby countdown ticks down inside a doodle circle.
// When the first round begins, crayon strokes sweep across and the paper peels away.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { displayName } from '../shared.js';
import { TEAM_COLORS, fx } from '../fx/fx.js';
import { sfx } from '../fx/sfx.js';
import KeyHint from './KeyHint.vue';

const props = defineProps({
  teams: { type: Array, required: true },
  users: { type: Object, required: true },
  userId: { type: String, required: true },
  secondsLeft: Number, // lobby countdown (undefined once the round has started or the start was cancelled)
  started: { type: Boolean, default: false }, // the first round is on
});
const emit = defineEmits(['done']);

const MIN_SHOW_MS = 2700;
const leaving = ref(false);
const fast = ref(false);
const shownAt = Date.now();
const timers = [];
const later = (fn, ms) => timers.push(setTimeout(fn, ms));

const roster = computed(() =>
  props.teams.slice(0, 2).map((t, i) => ({
    name: t.name,
    color: TEAM_COLORS[i],
    players: t.userIds.map((id) => ({ id, name: props.users[id] ? displayName(props.users[id]) : '…', me: id === props.userId })),
  })),
);

// doodles scattered around the edge of the page (x%, y%, size, rotation, kind, delay)
const DOODLES = [
  [7, 14, 42, -12, 'star', 0.9],
  [90, 12, 36, 14, 'swirl', 1.0],
  [5, 78, 34, 8, 'heart', 1.1],
  [93, 80, 44, -8, 'star', 1.15],
  [16, 46, 26, 20, 'spark', 1.25],
  [84, 46, 28, -16, 'spark', 1.3],
  [30, 88, 30, 0, 'squiggle', 1.2],
  [70, 90, 30, 180, 'squiggle', 1.35],
  [50, 6, 24, 0, 'spark', 1.4],
];
const DOODLE_PATHS = {
  star: 'M24 4l6 13 14 2-10 10 3 14-13-7-13 7 3-14L4 19l14-2z',
  heart: 'M24 42C14 34 4 27 4 17 4 10 9 6 15 6c4 0 7 2 9 6 2-4 5-6 9-6 6 0 11 4 11 11 0 10-10 17-20 25z',
  swirl: 'M24 24a3 3 0 11-3-3 6 6 0 016 6 9 9 0 01-9 9 12 12 0 01-12-12A15 15 0 0121 9a18 18 0 0118 18',
  spark: 'M24 4v12M24 32v12M4 24h12M32 24h12M10 10l7 7M31 31l7 7M38 10l-7 7M17 31l-7 7',
  squiggle: 'M4 24c5-10 10-10 15 0s10 10 15 0 10-10 10-4',
};

const countText = computed(() => (props.started ? 'draw!' : props.secondsLeft !== undefined ? String(props.secondsLeft) : ''));

function leave(quick = false) {
  if (leaving.value) return;
  fast.value = quick;
  leaving.value = true;
  if (!quick) {
    sfx('go');
    fx('confetti', { count: 60 });
  }
  later(() => emit('done'), quick ? 320 : 1050);
}

watch(
  () => props.started,
  (s) => {
    if (!s) return;
    later(() => leave(false), Math.max(0, MIN_SHOW_MS - (Date.now() - shownAt)));
  },
  { immediate: true },
);
// the start was cancelled from the lobby
watch(
  () => props.secondsLeft,
  (s, prev) => {
    if (s === undefined && !props.started) leave(true);
    else if (s !== undefined && prev !== undefined && s !== prev && Date.now() - shownAt > 1500) sfx('tick');
  },
);

function onKey(e) {
  if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.stopImmediatePropagation();
    leave(true);
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKey, true);
  sfx('whoosh');
  later(() => sfx('stamp'), 760);
  later(() => sfx('sparkle'), 1250);
});
onUnmounted(() => {
  window.removeEventListener('keydown', onKey, true);
  timers.forEach(clearTimeout);
});
</script>

<template>
  <div class="fxi" :class="{ leaving, fast }" role="status" aria-label="the game is starting" @click="leave(true)">
    <div class="fxi-paper">
      <div class="fxi-lines" />
      <svg
        v-for="(d, i) in DOODLES"
        :key="i"
        class="fxi-doodle"
        :class="'k-' + d[4]"
        viewBox="0 0 48 48"
        :style="{ left: d[0] + '%', top: d[1] + '%', width: d[2] + 'px', '--r': d[3] + 'deg', '--d': d[5] + 's' }"
      >
        <path :d="DOODLE_PATHS[d[4]]" pathLength="1" />
      </svg>

      <div class="fxi-title">
        <svg viewBox="0 0 520 120" class="fxi-title-svg">
          <text x="260" y="88" text-anchor="middle">draw battle!</text>
          <path class="fxi-underline" d="M86 104c60-10 150-12 220-6s110 4 136-2" pathLength="1" />
        </svg>
        <svg class="fxi-pencil" viewBox="0 0 48 48"><path d="M8 40l2-9L32 9a4 4 0 016 6L16 37zM28 13l6 6M8 40l8-3" /></svg>
      </div>

      <div class="fxi-stage">
        <div v-for="(t, i) in roster" :key="i" class="fxi-team" :class="i === 0 ? 'left' : 'right'" :style="{ '--c0': t.color[0], '--c1': t.color[1], '--c2': t.color[2] }">
          <div class="fxi-team-name">{{ t.name }}</div>
          <div class="fxi-players">
            <span
              v-for="(p, j) in t.players"
              :key="p.id"
              class="fxi-player"
              :class="{ me: p.me }"
              :style="{ '--d': 0.42 + j * 0.07 + 's' }"
            >
              <span class="fxi-avatar">{{ p.name.slice(0, 1) }}</span>{{ p.name }}
            </span>
          </div>
        </div>
        <div class="fxi-vs">
          <svg class="fxi-splat" viewBox="0 0 120 120">
            <path d="M60 14c8 10 18 2 22 12s16 8 12 20 12 14 2 22-2 20-14 20-14 14-24 6-20 4-22-8-18-10-10-22-12-16 2-22 14-14 12-26 14-4 14-8z" />
          </svg>
          <span class="fxi-vs-text">vs</span>
        </div>
      </div>

      <div class="fxi-count-wrap">
        <div v-if="countText" :key="countText" class="fxi-count" :class="{ go: started }">
          <svg class="fxi-count-ring" viewBox="0 0 100 100"><path d="M50 8c24-1 42 18 42 42S73 92 49 92 8 74 8 50 27 9 52 9" pathLength="1" /></svg>
          <span>{{ countText }}</span>
        </div>
      </div>
      <div class="fxi-skip"><KeyHint k="esc" /> skip</div>
    </div>

    <svg class="fxi-wipe" viewBox="0 0 1000 600" preserveAspectRatio="none">
      <path class="w1" d="M-80 120C200 40 420 220 640 120S900 40 1080 90" pathLength="1" />
      <path class="w2" d="M-80 330C160 250 400 420 620 320S880 250 1080 300" pathLength="1" />
      <path class="w3" d="M-80 540C200 450 430 620 650 520S900 450 1080 500" pathLength="1" />
    </svg>
  </div>
</template>
