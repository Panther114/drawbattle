<script setup>
import { FinalRoundStage } from '../shared.js';
import FinalRoundEndOverlay from './FinalRoundEndOverlay.vue';
import FinalRoundStartOverlay from './FinalRoundStartOverlay.vue';
import FinalRoundTransitionOverlay from './FinalRoundTransitionOverlay.vue';

defineProps({
  userId: { type: String },
  teams: { type: Array, required: true },
  teamIndex: { type: Number, required: true },
  finalRound: { type: Object, required: true },
  finalRoundStageWithContext: { type: Object, required: true },
  users: { type: Object, required: true },
  isWinning: { type: Boolean, default: false },
  score: { type: String, required: true },
  size: { type: Number, required: true },
});
</script>

<template>
  <FinalRoundStartOverlay
    v-if="
      finalRoundStageWithContext.stage === FinalRoundStage.PreStartCountdown ||
      finalRoundStageWithContext.stage === FinalRoundStage.StartCountdown
    "
    :user-id="userId"
    :teams="teams"
    :team-index="teamIndex"
    :users="users"
    :final-round="finalRound"
    :final-round-stage="finalRoundStageWithContext.stage"
    :final-round-stage-seconds-remaining="finalRoundStageWithContext.secondsRemaining"
    :size="size"
  />
  <template
    v-else-if="
      finalRoundStageWithContext.stage !== FinalRoundStage.InProgress ||
      finalRoundStageWithContext.areTeamsDrawing[teamIndex]
    "
  >
    <FinalRoundEndOverlay
      v-if="finalRoundStageWithContext.stage === FinalRoundStage.RoundEnd"
      :team-index="teamIndex"
      :teams="teams"
      :did-win="isWinning"
      :score="score"
      :size="size"
    />
  </template>
  <FinalRoundTransitionOverlay
    v-else
    :user-id="userId"
    :team-index="teamIndex"
    :final-round="finalRound"
    :users="users"
    :size="size"
  />
</template>
