<script setup>
import { onMounted, onUnmounted, ref } from 'vue';

// The home page's scenery: soft rainbow glows in the logo's colours drifting under a sheet of paper grain, and a
// scatter of doodles that float about. On desktop the doodles (and anything else on the page marked data-depth /
// data-tilt) lean a little toward the mouse and slide at their own pace when scrolling.

// doodle outlines on a 24x24 grid, drawn as one rounded stroke each
const SHAPES = {
  star: 'M12 2.8l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.6l-5.6 3.2 1.3-6.2L3 9.3l6.3-.7z',
  swirl: 'M12.4 12.2c.2-1.2 1.8-1.4 2.3-.3.7 1.5-.5 3.2-2.1 3.3-2.3.2-3.9-2-3.4-4.2.6-2.8 3.7-4.2 6.3-3.1 3.4 1.4 4.3 5.8 2.3 8.7',
  heart: 'M12 19.6s-7.2-4.3-7.2-9.6A3.9 3.9 0 0112 7.7a3.9 3.9 0 017.2 2.3c0 5.3-7.2 9.6-7.2 9.6z',
  squiggle: 'M2.5 13.5c1.6-3.4 3.2-3.4 4.8 0s3.2 3.4 4.8 0 3.2-3.4 4.8 0 2.4 2.6 4.1.6',
  bolt: 'M13.5 2.8L5 13.6h5.8l-1.3 7.6L19 9.8h-6z',
  cloud: 'M7.2 18.2h9.9a3.9 3.9 0 00.5-7.8 5.7 5.7 0 00-11 1.5 3.2 3.2 0 00.6 6.3z',
  pencil: 'M4.5 19.5l1-4.4L16.6 4a2 2 0 012.9 2.9L8.4 18zM14.4 6.2l2.9 2.9',
  smile: 'M12 3.6a8.4 8.4 0 110 16.8 8.4 8.4 0 010-16.8zM9 9.6v.6M15 9.6v.6M8.4 14c1.9 2.2 5.3 2.2 7.2 0',
  sparkle: 'M11 3l2 6.2 6.2 2-6.2 2L11 19.4l-2-6.2-6.2-2 6.2-2zM19 3.5v3M17.5 5h3',
  crown: 'M4.2 17.4L3.2 8l5 4.2 3.8-7 3.8 7 5-4.2-1 9.4zM4.6 20h14.8',
  bubble: 'M5 5.5h14a1.6 1.6 0 011.6 1.6v8.6a1.6 1.6 0 01-1.6 1.6h-7.4L7 20.6v-3.3H5a1.6 1.6 0 01-1.6-1.6V7.1A1.6 1.6 0 015 5.5z',
  loop: 'M3 16c3-1 5.2-3.6 5.6-6.3.3-2.2-1.6-3.6-3-2.2-1.9 1.8.2 6.2 4.4 6.8 3.6.5 6.3-2.4 7.4-5.6M15 6.8l2.6 1.8 1.4-2.9',
};
// [shape, left %, top %, size px, colour, tilt, layer (0 far .. 2 near), seconds per float, shown on phones]
const DOODLES = [
  ['star', 6, 62, 46, 'y', -14, 2, 7.5, true],
  ['swirl', 15, 86, 52, 'v', 10, 0, 9, false],
  ['heart', 60, 1.5, 32, 'm', 12, 1, 6.8, true],
  ['squiggle', 40, 86, 70, 'c', -6, 0, 8.4, false],
  ['bolt', 93, 12, 44, 'o', 14, 2, 7.2, true],
  ['cloud', 70, 4, 58, 'b', -4, 0, 10, false],
  ['pencil', 88, 78, 50, 'o', -18, 2, 8, true],
  ['smile', 57, 84, 42, 'y', 8, 1, 9.4, false],
  ['sparkle', 30, 3, 38, 'c', 0, 2, 6.4, true],
  ['crown', 97, 46, 40, 'y', 10, 0, 8.8, false],
  ['bubble', 13, 44, 44, 'm', -10, 1, 7.8, false],
  ['loop', 78, 88, 60, 'v', 4, 1, 9.6, true],
];
// the doodles move as three sheets, one per depth: a handful of moving layers instead of a dozen
const LAYER_DEPTHS = [10, 18, 28];
const layers = LAYER_DEPTHS.map((depth, layer) => ({
  depth,
  doodles: DOODLES.flatMap(([shape, x, y, size, color, tilt, l, dur, phone], i) =>
    l !== layer
      ? []
      : [
          {
            d: SHAPES[shape],
            phone,
            style: { left: `${x}%`, top: `${y}%`, width: `${size}px`, height: `${size}px`, '--c': `var(--hm-${color})`, '--tilt': `${tilt}deg`, '--dur': `${dur}s`, '--del': `${-i * 0.9}s` },
          },
        ],
  ),
}));

const root = ref();
let targets = []; // [element, depth, kind]: 'tilt' leans in 3D, 'doodle' also lags behind the scroll, 'drift' only follows the mouse
let raf = 0;
// where the mouse is (-1..1 across the window) and how far the page is scrolled: the goal, and where we are now
let goal = { x: 0, y: 0, s: 0 };
let now = { x: 0, y: 0, s: 0 };

function frame() {
  raf = 0;
  if (document.hidden) return;
  // ease toward the goal: a soft lag so the scene feels heavy and floaty rather than glued to the cursor
  now.x += (goal.x - now.x) * 0.075;
  now.y += (goal.y - now.y) * 0.075;
  now.s += (goal.s - now.s) * 0.16;
  for (const [el, depth, kind] of targets) {
    if (kind === 'tilt') el.style.transform = `perspective(1100px) rotateX(${(-now.y * 3).toFixed(2)}deg) rotateY(${(now.x * 4).toFixed(2)}deg)`;
    else el.style.transform = `translate3d(${(now.x * depth).toFixed(1)}px, ${(now.y * depth + (kind === 'doodle' ? now.s * depth * 0.01 : 0)).toFixed(1)}px, 0)`;
  }
  const settled = Math.abs(goal.x - now.x) + Math.abs(goal.y - now.y) < 0.002 && Math.abs(goal.s - now.s) < 0.5;
  if (!settled) raf = requestAnimationFrame(frame);
}
const kick = () => {
  if (!raf) raf = requestAnimationFrame(frame);
};
function onMove(e) {
  goal.x = (e.clientX / window.innerWidth) * 2 - 1;
  goal.y = (e.clientY / window.innerHeight) * 2 - 1;
  kick();
}
function onScroll() {
  goal.s = window.scrollY;
  kick();
}

let active = false;
onMounted(() => {
  // only for a real mouse, and never for players who asked their system for less motion
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const mouse = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  if (calm || !mouse) return;
  const page = root.value?.closest('.hm-root') ?? document;
  targets = [...page.querySelectorAll('[data-depth], [data-tilt]')].map((el) => [
    el,
    Number(el.dataset.depth ?? 0),
    el.hasAttribute('data-tilt') ? 'tilt' : el.classList.contains('hm-doodle-layer') ? 'doodle' : 'drift',
  ]);
  active = true;
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
});
onUnmounted(() => {
  if (!active) return;
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('scroll', onScroll);
  cancelAnimationFrame(raf);
});
</script>

<template>
  <div ref="root" class="hm-bg" aria-hidden="true">
    <div class="hm-aurora" data-depth="-16">
      <span class="hm-blob hm-blob1" />
      <span class="hm-blob hm-blob2" />
      <span class="hm-blob hm-blob3" />
      <span class="hm-blob hm-blob4" />
      <span class="hm-blob hm-blob5" />
    </div>
    <div class="hm-grid" />
    <div class="hm-grain" />
  </div>
  <div class="hm-doodles" aria-hidden="true">
    <div v-for="(layer, l) in layers" :key="l" class="hm-doodle-layer" :data-depth="layer.depth">
      <span v-for="(dd, i) in layer.doodles" :key="i" class="hm-doodle" :class="{ 'hm-doodle-wide': !dd.phone }" :style="dd.style">
        <span class="hm-doodle-bob"><svg viewBox="0 0 24 24"><path :d="dd.d" /></svg></span>
      </span>
    </div>
  </div>
</template>
