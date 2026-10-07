<script setup>
import { watch } from 'vue';
import { FinalRoundStage, S, Sound } from '../shared.js';
import FinalRoundSidebar from './FinalRoundSidebar.vue';
import SpectatorFinalRoundTeamView from './SpectatorFinalRoundTeamView.vue';
import { ref } from 'vue';

const props = defineProps({
  finalRound: { type: Object, required: true },
  finalRoundStageWithContext: { type: Object, required: true },
  users: { type: Object, required: true },
  teams: { type: Array, required: true },
});
const emit = defineEmits(['audio-cue']);

const views = props.teams.map(() => ref());

watch(
  () => props.finalRoundStageWithContext,
  (now, before) => {
    if (now.stage === FinalRoundStage.StartCountdown) emit('audio-cue', Sound.BeepLow);
    if (before.stage === FinalRoundStage.StartCountdown && now.stage === FinalRoundStage.InProgress) {
      emit('audio-cue', Sound.BeepHigh);
    }
  },
);

defineExpose({
  processMessage(msg) {
    if (msg[0] === S.CanvasOperation) {
      const [, idx, teamIdx, op] = msg;
      if (!Array.isArray(idx)) throw new Error('Unexpected roundIndexInput in SpectatorFinalRound processMessage');
      views[teamIdx].value?.processOperation(idx[0], op);
    }
  },
});
</script>

<template>
  <div class="mp-main">
    <div class="mp-left-spectator">
      <div class="sp-team-views">
        <SpectatorFinalRoundTeamView
          v-for="(team, i) in teams"
          :key="i"
          :ref="(el) => (views[i].value = el)"
          class="sp-team-view final"
          :team-index="i"
          :team="team"
          :team-states="finalRound.teamStates[i]"
          :final-round="finalRound"
          :final-round-stage-with-context="finalRoundStageWithContext"
          :users="users"
          :teams="teams"
        />
      </div>
    </div>
    <div class="mp-side-pane">
      <div class="mp-side-divider" />
      <div class="mp-side-content">
        <FinalRoundSidebar :final-round="finalRound" :teams="teams" />
      </div>
    </div>
  </div>
</template>
