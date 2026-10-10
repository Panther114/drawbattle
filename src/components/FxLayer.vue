<script setup>
// The celebration layer: banners, confetti bursts, soft flashes, round wipes and quick reactions.
// It never takes clicks (pointer-events: none) and only animates transform/opacity, so it stays cheap.
import { onMounted, onUnmounted, ref } from 'vue';
import confetti from 'canvas-confetti';
import { PARTY, TEAM_COLORS, fxOn, onFx } from '../fx/fx.js';
import { sfx } from '../fx/sfx.js';
import { REACTIONS } from '../fx/reactions.js';
import ReactionFace from './ReactionFace.vue';

defineProps({ urgent: { type: Boolean, default: false } });

const canvas = ref();
const banners = ref([]);
const flashes = ref([]);
const wipes = ref([]);
const reactions = ref([]);
let shoot;
let seq = 0;
let off;
const timers = new Set();
const later = (fn, ms) => {
  const t = setTimeout(() => {
    timers.delete(t);
    fn();
  }, ms);
  timers.add(t);
};
const drop = (list, id) => (list.value = list.value.filter((x) => x.id !== id));

// little doodle icons for the banners
const ICONS = {
  bolt: 'M27 4L10 27h11l-4 17 19-25H25z',
  flame: 'M24 44c-9 0-14-6-14-13 0-8 7-11 7-19 4 3 6 7 6 10 2-2 3-5 3-8 7 5 12 11 12 18 0 7-5 12-14 12zM24 44c-4 0-6-3-6-6 0-4 4-6 5-10 4 4 7 6 7 10 0 3-2 6-6 6z',
  scale: 'M24 6v34M14 42h20M8 14h32M8 14l-5 12h10zM40 14l-5 12h10zM3 26a5 4 0 0010 0M35 26a5 4 0 0010 0',
  swap: 'M6 16h30M28 8l8 8-8 8M42 32H12M20 24l-8 8 8 8',
  crown: 'M6 36L4 14l11 9 9-15 9 15 11-9-2 22zM8 42h32',
  star: 'M24 4l6 13 14 2-10 10 3 14-13-7-13 7 3-14L4 19l14-2z',
  pencil: 'M8 40l2-9L32 9a4 4 0 016 6L16 37zM28 13l6 6',
};

function onEvent(kind, d) {
  const id = ++seq;
  switch (kind) {
    case 'banner': {
      banners.value = [...banners.value.slice(-1), { id, ...d }];
      later(() => drop(banners, id), d.ms ?? 2600);
      if (d.sound) sfx(d.sound);
      break;
    }
    case 'burst':
      shoot?.({
        particleCount: d.count ?? 46,
        spread: d.spread ?? 70,
        startVelocity: d.velocity ?? 32,
        ticks: 140,
        gravity: 0.9,
        scalar: d.scalar ?? 0.9,
        shapes: d.shapes ?? ['circle', 'square', 'star'],
        colors: d.colors ?? PARTY,
        origin: { x: (d.x ?? window.innerWidth / 2) / window.innerWidth, y: (d.y ?? window.innerHeight / 2) / window.innerHeight },
        angle: d.angle ?? 90,
        disableForReducedMotion: true,
      });
      break;
    case 'confetti': {
      const colors = d.colors ?? PARTY;
      const fire = (x, angle) =>
        shoot?.({ particleCount: d.count ?? 70, angle, spread: 60, startVelocity: 52, ticks: 200, origin: { x, y: 0.75 }, colors, scalar: 1, disableForReducedMotion: true });
      if (d.side !== 'right') fire(-0.02, 58);
      if (d.side !== 'left') fire(1.02, 122);
      break;
    }
    case 'flash':
      flashes.value = [...flashes.value, { id, color: d.color ?? '#ffe006' }];
      later(() => drop(flashes, id), 900);
      break;
    case 'wipe':
      wipes.value = [{ id, ...d }];
      later(() => drop(wipes, id), 1300);
      sfx('whoosh');
      break;
    case 'reaction': {
      const r = REACTIONS[d.r];
      if (!r) return;
      // a gentle sideways scatter so several reactions at once do not stack on top of each other
      const x = ((seq * 37) % 5) - 2;
      reactions.value = [...reactions.value.slice(-5), { id, r, name: d.name, team: d.team, mine: d.mine, x }];
      later(() => drop(reactions, id), 2800);
      sfx('pop');
      break;
    }
  }
}

onMounted(() => {
  shoot = confetti.create(canvas.value, { resize: true, useWorker: false });
  off = onFx(onEvent);
});
onUnmounted(() => {
  off?.();
  shoot?.reset();
  timers.forEach(clearTimeout);
});
const teamColor = (t) => (t === 0 || t === 1 ? TEAM_COLORS[t][1] : '#808080');
</script>

<template>
  <div class="fx-layer" aria-hidden="true">
    <canvas ref="canvas" class="fx-canvas" />
    <div v-if="urgent && fxOn()" class="fx-urgent" />
    <div v-for="f in flashes" :key="f.id" class="fx-flash" :style="{ '--fx-c': f.color }" />

    <div v-for="w in wipes" :key="w.id" class="fx-wipe" :style="{ '--fx-c': w.color ?? '#87e0ff' }">
      <svg class="fx-wipe-stroke" viewBox="0 0 1000 400" preserveAspectRatio="none">
        <path d="M-60 260C120 140 260 300 420 190S720 120 1060 150" pathLength="1" />
      </svg>
      <div class="fx-wipe-text">{{ w.text }}</div>
    </div>

    <TransitionGroup name="fxb" tag="div" class="fx-banners">
      <div v-for="b in banners" :key="b.id" class="fx-banner" :class="'tone-' + (b.tone ?? 'good')">
        <svg v-if="b.icon" class="fx-banner-icon" viewBox="0 0 48 48">
          <path :d="ICONS[b.icon]" />
        </svg>
        <div class="fx-banner-body">
          <div class="fx-banner-text">{{ b.text }}</div>
          <div v-if="b.sub" class="fx-banner-sub">{{ b.sub }}</div>
        </div>
        <span class="fx-spark s1" /><span class="fx-spark s2" /><span class="fx-spark s3" />
      </div>
    </TransitionGroup>

    <TransitionGroup name="fxr" tag="div" class="fx-reactions">
      <div v-for="x in reactions" :key="x.id" class="fx-reaction" :class="{ mine: x.mine }" :style="{ '--fx-x': x.x }">
        <ReactionFace :id="x.r.id" class="fx-reaction-face" />
        <div class="fx-reaction-bubble">
          <span class="fx-reaction-label">{{ x.r.label }}</span>
          <span class="fx-reaction-name" :style="{ color: teamColor(x.team) }">{{ x.name }}</span>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>
