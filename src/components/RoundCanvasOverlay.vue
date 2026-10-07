<script setup>
import { computed } from 'vue';
import { RoundStage, findCorrectGuess } from '../shared.js';
import RoundEndOverlay from './RoundEndOverlay.vue';
import RoundHeadStartOverlay from './RoundHeadStartOverlay.vue';
import RoundStartOverlay from './RoundStartOverlay.vue';

const props = defineProps({
  userId: { type: String, required: true },
  teamIndex: { type: Number, required: true },
  roundIndex: { type: Number, required: true },
  round: { type: Object, required: true },
  roundStage: { type: Number, required: true },
  roundStageSecondsRemaining: { type: Number, required: true },
  previousRounds: { type: Array, required: true },
  users: { type: Object, required: true },
  teams: { type: Array, required: true },
  size: { type: Number, required: true },
});
defineEmits(['client-message']);

const didGuess = computed(
  () => findCorrectGuess(props.round.teamStates[props.teamIndex].guesses, props.round.word) !== undefined,
);
</script>

<template>
  <RoundStartOverlay
    v-if="roundStage === RoundStage.ChooseWord || roundStage === RoundStage.DrawingCountdown"
    :user-id="userId"
    :team-index="teamIndex"
    :round-index="roundIndex"
    :round="round"
    :round-stage="roundStage"
    :round-stage-seconds-remaining="roundStageSecondsRemaining"
    :previous-rounds="previousRounds"
    :users="users"
    :size="size"
    @client-message="(m) => $emit('client-message', m)"
  />
  <RoundHeadStartOverlay
    v-else-if="roundStage === RoundStage.DrawingHeadStart"
    :user-id="userId"
    :round="round"
    :round-stage-seconds-remaining="roundStageSecondsRemaining"
    :users="users"
    :size="size"
  />
  <RoundEndOverlay
    v-else-if="didGuess || roundStage === RoundStage.DrawingEnd"
    :team-index="teamIndex"
    :round="round"
    :round-stage="roundStage"
    :teams="teams"
    :size="size"
  />
</template>
