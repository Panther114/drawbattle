<script setup>
import { computed, ref, watch } from 'vue';
import { RoundStage, S, Sound, bothGuessedTime, formatClock } from '../shared.js';
import SpectatorTeamView from './SpectatorTeamView.vue';

const props = defineProps({
  roundIndex: { type: Number, required: true },
  round: { type: Object, required: true },
  roundStage: { type: Number, required: true },
  roundStageSecondsRemaining: { type: Number, required: true },
  previousRounds: { type: Array, required: true },
  users: { type: Object, required: true },
  teams: { type: Array, required: true },
  gameSettings: { type: Object, required: true },
});
const emit = defineEmits(['audio-cue']);

const views = props.teams.map(() => ref());
const guessedTime = computed(() => bothGuessedTime(props.round));

const clock = computed(() => {
  const roundLength = props.gameSettings.roundLengthSec;
  let t = roundLength;
  if (props.roundStage === RoundStage.Drawing) t = props.roundStageSecondsRemaining;
  else if (props.roundStage === RoundStage.DrawingEnd) {
    if (guessedTime.value !== undefined) {
      const elapsed =
        guessedTime.value - (props.round.wordChosenTime + 1000 * (props.round.chooserHeadStartSeconds + 3));
      t = Math.ceil(roundLength - elapsed / 1000);
    } else t = 0;
  }
  return formatClock(t);
});

watch(
  () => props.roundStage,
  (stage) => {
    if (stage === RoundStage.Drawing) emit('audio-cue', Sound.BeepHigh);
    else if (stage === RoundStage.DrawingEnd && guessedTime.value === undefined) emit('audio-cue', Sound.Buzzer);
  },
);
watch([() => props.roundStage, () => props.roundStageSecondsRemaining], ([stage, secs]) => {
  const countdown = stage === RoundStage.DrawingCountdown && props.round.chooserHeadStartSeconds === 0;
  const waiting = stage === RoundStage.DrawingHeadStart;
  if (countdown || waiting) emit('audio-cue', Sound.BeepLow);
  else if (stage === RoundStage.Drawing && secs <= 5) emit('audio-cue', Sound.ClockTick);
});

defineExpose({
  processMessage(msg) {
    if (msg[0] === S.CanvasOperation) {
      const [, , teamIdx, op] = msg;
      views[teamIdx].value?.processOperation(op);
    }
  },
});
</script>

<template>
  <div class="sp-round">
    <div class="sp-header">
      <div class="sp-header-word" :class="{ choosing: round.word === undefined }">
        {{ round.word ?? `starting round ${roundIndex + 1}...` }}
      </div>
      <div class="sp-drawing-countdown">{{ clock }}</div>
    </div>
    <div class="sp-team-views">
      <SpectatorTeamView
        v-for="(team, i) in teams"
        :key="i"
        :ref="(el) => (views[i].value = el)"
        class="sp-team-view"
        :team-index="i"
        :team="team"
        :team-state="round.teamStates[i]"
        :round-index="roundIndex"
        :round="round"
        :round-stage="roundStage"
        :round-stage-seconds-remaining="roundStageSecondsRemaining"
        :previous-rounds="previousRounds"
        :users="users"
        :teams="teams"
      />
    </div>
  </div>
</template>
