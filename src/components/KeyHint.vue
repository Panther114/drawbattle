<script setup>
import { computed } from 'vue';

// A small keycap tile that names the key which does the same thing as the control beside it. Hidden on touch screens.
const props = defineProps({ k: { type: String, required: true } });

const NAMES = { enter: '↵', esc: 'Esc', left: '←', right: '→', up: '↑', down: '↓', space: 'Space', shift: '⇧', alt: 'Alt', ctrl: 'Ctrl' };
// "Alt+1" shows as two caps, "1–4" and "/" as one
const caps = computed(() => (props.k.length > 1 && props.k.includes('+') ? props.k.split('+') : [props.k]).map((c) => NAMES[c.toLowerCase()] ?? c.toUpperCase()));
</script>

<template>
  <span class="kh" aria-hidden="true"><kbd v-for="c in caps" :key="c" class="kh-cap" :class="{ wide: c.length > 1 }">{{ c }}</kbd></span>
</template>
