<script setup>
import CanvasOverlay from './CanvasOverlay.vue';

const props = defineProps({
  teamIndex: { type: Number, required: true },
  teams: { type: Array, required: true },
  didWin: { type: Boolean, required: true },
  score: { type: String, required: true },
  size: { type: Number, required: true },
});
const other = () => props.teams[(props.teamIndex + 1) % props.teams.length];
</script>

<template>
  <CanvasOverlay :vertical-center="true" :size="size" :class="{ 're-small': size === 1 }">
    <div class="re-graphic" :class="{ regular: size === 0, didwin: didWin }" />
    <div class="re-text">{{ didWin ? 'you win!' : `${other().name} wins!` }}</div>
    <div class="re-subtext gray">
      final score: <span class="re-score" :class="{ didwin: didWin }">{{ score }}</span>
    </div>
  </CanvasOverlay>
</template>
