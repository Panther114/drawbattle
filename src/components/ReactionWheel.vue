<script setup>
// Quick reactions: a radial wheel of hand-drawn stickers, opened with the smiley button or R.
// Inside the wheel 1-8 (or the arrow keys + enter) send one; Alt+1..8 sends one straight away, even mid-guess.
// The keys go through the app-wide registry (src/keys.js), so they also show up on the ? cheat sheet.
import { computed, onUnmounted, ref, watch } from 'vue';
import { Prio, registerKeys, useKeys } from '../keys.js';
import KeyHint from './KeyHint.vue';
import { REACTIONS, REACTION_COOLDOWN_MS } from '../fx/reactions.js';
import ReactionFace from './ReactionFace.vue';

const emit = defineEmits(['react']);

const open = ref(false);
const active = ref(-1);
const cooling = ref(false);
const RADIUS = 112;
const slots = computed(() =>
  REACTIONS.map((r, i) => {
    const a = (-90 + i * (360 / REACTIONS.length)) * (Math.PI / 180);
    return { ...r, i, x: Math.round(Math.cos(a) * RADIUS), y: Math.round(Math.sin(a) * RADIUS) };
  }),
);
const hub = computed(() => (active.value >= 0 ? REACTIONS[active.value].label : 'react'));

let coolTimer;
function send(i) {
  if (i < 0 || i >= REACTIONS.length) return;
  close();
  if (cooling.value) return;
  emit('react', i);
  cooling.value = true;
  clearTimeout(coolTimer);
  coolTimer = setTimeout(() => (cooling.value = false), REACTION_COOLDOWN_MS);
}
let returnFocus;
function toggle() {
  if (open.value) return close();
  returnFocus = document.activeElement;
  open.value = true;
  active.value = -1;
}
function close() {
  if (!open.value) return;
  open.value = false;
  // give the keyboard back to whatever had it (usually the guess box)
  if (returnFocus instanceof HTMLElement && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
  returnFocus = undefined;
}

const N = REACTIONS.length;
// Alt+1..8 sends straight away, even from the guess box; R opens the wheel
useKeys([
  ...REACTIONS.map((_, i) => ({ key: `alt+${i + 1}`, typing: true, run: () => send(i) })),
  { key: 'r', press: '.rw', run: toggle },
]);
// while the wheel is open it owns the keyboard
let offModal;
watch(open, (o) => {
  offModal?.();
  offModal = undefined;
  if (!o) return;
  const move = (step) => () => {
    active.value = (Math.max(active.value, 0) + step + N) % N;
  };
  offModal = registerKeys(
    [
      ...REACTIONS.map((_, i) => ({ key: String(i + 1), typing: true, press: '.rw-wheel', run: () => send(i) })),
      { key: ['right', 'down'], repeat: true, run: move(1) },
      { key: ['left', 'up'], repeat: true, run: move(-1) },
      { key: ['enter', 'space'], force: true, press: false, run: () => (active.value >= 0 ? send(active.value) : close()) },
      { key: ['esc', 'r', 'tab'], typing: true, press: false, run: close },
    ],
    { prio: Prio.modal, modal: true },
  );
});
onUnmounted(() => {
  offModal?.();
  clearTimeout(coolTimer);
});
</script>

<template>
  <div class="rw">
    <button
      v-tooltip="'quick reactions'"
      type="button"
      class="rw-trigger"
      :class="{ open, cooling }"
      aria-label="quick reactions"
      :aria-expanded="open"
      @click="toggle"
    >
      <ReactionFace id="nice" class="rw-trigger-face" />
      <KeyHint k="R" class="rw-trigger-key" />
    </button>

    <Transition name="rw">
      <div v-if="open" class="rw-scrim" @click.self="close">
        <div class="rw-wheel" role="menu" aria-label="quick reactions">
          <svg class="rw-ring" viewBox="0 0 300 300" aria-hidden="true">
            <path d="M150 22c72-2 128 56 128 128s-56 128-128 128S22 222 22 150 80 23 152 23" pathLength="1" />
          </svg>
          <div class="rw-hub">
            <span class="rw-hub-label">{{ hub }}</span>
            <span class="rw-hub-hint"><KeyHint k="1–8" /></span>
          </div>
          <button
            v-for="s in slots"
            :key="s.id"
            type="button"
            role="menuitem"
            class="rw-item"
            :class="{ active: active === s.i }"
            :style="{ '--x': s.x + 'px', '--y': s.y + 'px', '--i': s.i }"
            :aria-label="s.label"
            @mouseenter="active = s.i"
            @focus="active = s.i"
            @click="send(s.i)"
          >
            <ReactionFace :id="s.id" class="rw-item-face" />
            <span class="rw-item-label">{{ s.label }}</span>
            <KeyHint :k="String(s.i + 1)" class="rw-item-key" />
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
