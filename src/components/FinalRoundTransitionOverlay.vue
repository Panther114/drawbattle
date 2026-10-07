<script setup>
import { computed } from 'vue';
import { displayName } from '../shared.js';
import CanvasOverlay from './CanvasOverlay.vue';

const props = defineProps({
  userId: { type: String },
  teamIndex: { type: Number, required: true },
  finalRound: { type: Object, required: true },
  users: { type: Object, required: true },
  size: { type: Number, required: true },
});

const states = computed(() => props.finalRound.teamStates[props.teamIndex]);
const word = computed(() => props.finalRound.words[states.value.length - 1]);
const lastWord = computed(() => props.finalRound.words[states.value.length - 2]);
const drawerId = computed(() => states.value[states.value.length - 1].drawerId);
</script>

<template>
  <CanvasOverlay :vertical-center="true" :size="size" :class="{ 'ft-small': size === 1 }">
    <div class="ft-last-word"><div class="ft-big-check" />{{ lastWord }}</div>
    <div class="ft-spacer" />
    <div class="ft-bottom-text">
      <template v-if="drawerId === userId">
        <div>your turn to draw</div>
        <div class="ft-current-word">{{ word }}</div>
      </template>
      <div v-else>{{ displayName(users[drawerId]) }}'s turn to draw</div>
    </div>
  </CanvasOverlay>
</template>
