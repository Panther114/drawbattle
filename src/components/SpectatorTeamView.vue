<script setup>
import { computed, ref } from 'vue';
import { MessageKind, buildMessages, drawingStartTime, findCorrectGuess } from '../shared.js';
import DrawCanvas from './DrawCanvas.vue';
import DrawerIcon from './DrawerIcon.vue';
import MessageLog from './MessageLog.vue';
import RoundCanvasOverlay from './RoundCanvasOverlay.vue';
import Username from './Username.vue';

const props = defineProps({
  teamIndex: { type: Number, required: true },
  team: { type: Object, required: true },
  teamState: { type: Object, required: true },
  roundIndex: { type: Number, required: true },
  round: { type: Object, required: true },
  roundStage: { type: Number, required: true },
  roundStageSecondsRemaining: { type: Number, required: true },
  previousRounds: { type: Array, required: true },
  users: { type: Object, required: true },
  teams: { type: Array, required: true },
});

const canvas = ref();
defineExpose({ processOperation: (op) => canvas.value?.processOperation(op) });

const drawer = computed(() => props.users[props.teamState.drawerId]);
const didGuess = computed(() => findCorrectGuess(props.teamState.guesses, props.round.word) !== undefined);
const messages = computed(() =>
  buildMessages(
    drawer.value,
    props.round.word,
    props.teamState.guesses,
    drawingStartTime(props.round, props.teamIndex),
    [MessageKind.Guessers],
  ),
);
</script>

<template>
  <div>
    <div class="sp-final-header">
      <div />
      <div class="sp-drawer">
        <DrawerIcon />
        <div class="sp-drawer-name"><Username :user="drawer" /></div>
      </div>
    </div>
    <DrawCanvas
      ref="canvas"
      class="sp-draw-canvas"
      :canvas-operations="teamState.canvasOperations"
      :team-index="teamIndex"
      :did-guess-word="didGuess"
    >
      <RoundCanvasOverlay
        :user-id="teamState.drawerId"
        :team-index="teamIndex"
        :round-index="roundIndex"
        :round="round"
        :round-stage="roundStage"
        :round-stage-seconds-remaining="roundStageSecondsRemaining"
        :previous-rounds="previousRounds"
        :users="users"
        :teams="teams"
        :size="1"
      />
    </DrawCanvas>
    <MessageLog :messages="messages" :users="users" :team="team" />
  </div>
</template>
