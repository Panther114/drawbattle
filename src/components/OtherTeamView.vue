<script setup>
import { computed, ref } from 'vue';
import { buildMessages, drawingStartTime, findCorrectGuess, guessMatches } from '../shared.js';
import DrawCanvas from './DrawCanvas.vue';
import DrawerIcon from './DrawerIcon.vue';
import MessageLog from './MessageLog.vue';
import Username from './Username.vue';
import { RoundStage } from '../shared.js';

const props = defineProps({
  teamIndex: { type: Number, required: true },
  team: { type: Object, required: true },
  teamState: { type: Object, required: true },
  round: { type: Object, required: true },
  roundStage: { type: Number, required: true },
  word: { type: String },
  users: { type: Object, required: true },
  showFullView: { type: Boolean, required: true },
});

const canvas = ref();
defineExpose({ processOperation: (op) => canvas.value?.processOperation(op) });

const drawer = computed(() => props.users[props.teamState.drawerId]);
const guesses = computed(() => props.teamState.guesses);
const didGuess = computed(() => findCorrectGuess(guesses.value, props.word) !== undefined);
const messages = computed(() =>
  buildMessages(drawer.value, props.word, guesses.value, drawingStartTime(props.round, props.teamIndex), []),
);
// guesses up to and including the first correct one, newest first (shown as dots when blurred)
const dots = computed(() => {
  const out = [];
  for (const g of guesses.value) {
    out.unshift(g);
    if (guessMatches(g.guess, props.word)) break;
  }
  return out;
});
</script>

<template>
  <div class="ot-root">
    <div class="ot-header">
      <div>{{ team.name }}</div>
      <div class="ot-drawer">
        <DrawerIcon size="small" />
        <div class="ot-drawer-name"><Username :user="drawer" /></div>
      </div>
    </div>
    <DrawCanvas
      :key="showFullView.toString()"
      ref="canvas"
      class="ot-canvas"
      :canvas-operations="teamState.canvasOperations"
      :team-index="teamIndex"
      :blur="!showFullView"
      :did-guess-word="didGuess"
      :hide-content="roundStage === RoundStage.DrawingHeadStart"
      :is-other-team="true"
    />
    <MessageLog
      v-if="showFullView"
      :messages="messages"
      :users="users"
      :team="team"
      :other-team-view="true"
    />
    <div v-else class="ot-guesses">
      <div
        v-for="(g, i) in dots"
        :key="i"
        class="ot-guess-icon"
        :class="{ correct: guessMatches(g.guess, word) }"
      />
    </div>
  </div>
</template>
