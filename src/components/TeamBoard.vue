<script setup>
import { computed, ref } from 'vue';
import { MessageKind, buildMessages, displayName, findCorrectGuess } from '../shared.js';
import DrawCanvas from './DrawCanvas.vue';
import DrawerIcon from './DrawerIcon.vue';
import MessageLog from './MessageLog.vue';
import Username from './Username.vue';

const props = defineProps({
  users: { type: Object, required: true },
  team: { type: Object, required: true },
  teamState: { type: Object, required: true },
  word: { type: String, required: true },
  drawingStageStartTime: { type: Number, required: true },
  onSummaryScreen: { type: Boolean, default: false },
  showMessageLog: { type: Boolean, default: true },
  showDisconnectedStatus: { type: Boolean, default: true },
});

const canvas = ref();
const drawer = computed(() => props.users[props.teamState.drawerId]);
const didGuess = computed(() => findCorrectGuess(props.teamState.guesses, props.word) !== undefined);
const messages = computed(() =>
  buildMessages(drawer.value, props.word, props.teamState.guesses, props.drawingStageStartTime, []),
);
const replay = () => canvas.value?.replayDrawing();
void MessageKind;
</script>

<template>
  <div>
    <div class="tb-header">
      <div class="tb-drawer">
        <DrawerIcon class="tb-drawer-icon" :class="{ 'on-summary': onSummaryScreen }" />
        <div class="tb-drawer-name">
          <Username v-if="showDisconnectedStatus" :user="drawer" />
          <span v-else>{{ displayName(drawer) }}</span>
        </div>
      </div>
      <button class="tb-replay" @click="replay">
        <div class="tb-replay-icon" />
        <div>replay</div>
      </button>
    </div>
    <DrawCanvas ref="canvas" :canvas-operations="teamState.canvasOperations" :did-guess-word="didGuess" />
    <MessageLog v-if="showMessageLog" class="tb-log" :messages="messages" :users="users" :team="team" />
  </div>
</template>
