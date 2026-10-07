<script setup>
import { computed, ref, watch } from 'vue';
import { FinalRoundStage, MessageKind, buildMessages, finalWordsDone } from '../shared.js';
import DrawCanvas from './DrawCanvas.vue';
import DrawerIcon from './DrawerIcon.vue';
import FinalRoundCanvasOverlay from './FinalRoundCanvasOverlay.vue';
import MessageLog from './MessageLog.vue';
import Username from './Username.vue';

const props = defineProps({
  teamIndex: { type: Number, required: true },
  team: { type: Object, required: true },
  teamStates: { type: Object, required: true },
  finalRound: { type: Object, required: true },
  finalRoundStageWithContext: { type: Object, required: true },
  users: { type: Object, required: true },
  teams: { type: Array, required: true },
});

const canvas = ref();
const lastIndex = computed(() => props.teamStates.length - 1);
const current = computed(() => props.teamStates[lastIndex.value]);
const st = computed(() => props.finalRoundStageWithContext);
const isTeamDrawing = computed(
  () => st.value.stage === FinalRoundStage.InProgress && st.value.areTeamsDrawing[props.teamIndex],
);
const drawer = computed(() =>
  st.value.stage !== FinalRoundStage.InProgress || st.value.areTeamsDrawing[props.teamIndex]
    ? props.users[current.value.drawerId]
    : props.users[props.teamStates[lastIndex.value - 1].drawerId],
);
const messages = computed(() => {
  const out = [];
  props.teamStates.forEach((s, i) => {
    out.push(...buildMessages(props.users[s.drawerId], props.finalRound.words[i], s.guesses, s.startTime, []));
  });
  return out;
});
const status = computed(() => {
  const mine = finalWordsDone(props.finalRound, props.teamIndex);
  const others = props.teams
    .map((_, i) => i)
    .filter((i) => i !== props.teamIndex)
    .map((i) => finalWordsDone(props.finalRound, i));
  const best = Math.max(...others);
  const isWinning = mine !== best ? mine > best : undefined;
  return {
    isWinning,
    didGuessWord:
      (st.value.stage === FinalRoundStage.InProgress && !st.value.areTeamsDrawing[props.teamIndex]) ||
      (st.value.stage === FinalRoundStage.RoundEnd && isWinning === true),
    scoreDisplay: [mine, ...others].join(' - '),
  };
});

watch(isTeamDrawing, (now, before) => {
  if (now && !before) canvas.value.resetCanvas();
});

defineExpose({
  processOperation(idx, op) {
    if (lastIndex.value === idx) canvas.value?.processOperation(op);
  },
});
void MessageKind;
</script>

<template>
  <div>
    <div class="sp-final-header">
      <div v-if="st.stage === FinalRoundStage.PreStartCountdown" />
      <div v-else-if="status.didGuessWord" class="sp-correct-word">{{ finalRound.words[lastIndex - 1] }}</div>
      <div v-else>{{ finalRound.words[lastIndex] }}</div>
      <div class="sp-drawer">
        <DrawerIcon />
        <div class="sp-drawer-name"><Username :user="drawer" /></div>
      </div>
    </div>
    <DrawCanvas
      ref="canvas"
      class="sp-draw-canvas"
      :canvas-operations="current.canvasOperations"
      :team-index="teamIndex"
      :did-guess-word="status.didGuessWord"
    >
      <FinalRoundCanvasOverlay
        :teams="teams"
        :team-index="teamIndex"
        :final-round="finalRound"
        :final-round-stage-with-context="finalRoundStageWithContext"
        :users="users"
        :is-winning="status.isWinning"
        :score="status.scoreDisplay"
        :size="1"
      />
    </DrawCanvas>
    <MessageLog :messages="messages" :users="users" :team="team" />
  </div>
</template>
