<script setup>
import { computed } from 'vue';
import { RoundStage, findCorrectGuess, roundResults } from '../shared.js';
import CanvasOverlay from './CanvasOverlay.vue';

const props = defineProps({
  teamIndex: { type: Number, required: true },
  round: { type: Object, required: true },
  roundStage: { type: Number, required: true },
  teams: { type: Array, required: true },
  size: { type: Number, required: true },
});

const result = computed(() => roundResults(props.round)[props.teamIndex]);
const otherTeam = computed(() => props.teams[(props.teamIndex + 1) % props.teams.length]);
const didGuess = computed(
  () => findCorrectGuess(props.round.teamStates[props.teamIndex].guesses, props.round.word) !== undefined,
);

const timeText = computed(() => {
  const t = result.value.timeDifferential;
  if (t === undefined) return '';
  const v = t < 1000 ? Math.ceil(t / 100) / 10 : Math.ceil(t / 1000);
  return ` by ${v} ${v === 1 ? 'second' : 'seconds'}`;
});
</script>

<template>
  <CanvasOverlay :vertical-center="true" :size="size">
    <div class="re-graphic re-round" :class="{ regular: size === 0, didwin: result.didWin }" />
    <template v-if="roundStage === RoundStage.Drawing">
      <div class="re-text re-round">you win!</div>
      <div class="re-subtext re-round">waiting for {{ otherTeam.name }}...</div>
    </template>
    <template v-else-if="didGuess">
      <div class="re-text re-round">you {{ result.didWin ? 'won' : 'lost' }}{{ timeText }}!</div>
      <div class="re-subtext re-round"><span class="re-score-dark">+{{ result.score }}</span> points</div>
    </template>
    <template v-else>
      <div class="re-text re-round">time's up!</div>
      <div class="re-subtext re-round">the word was <span class="re-incorrect">{{ round.word }}</span></div>
    </template>
  </CanvasOverlay>
</template>
