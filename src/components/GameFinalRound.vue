<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import {
  C,
  FinalRoundStage,
  MAX_GUESS_LENGTH,
  MessageKind,
  Op,
  S,
  Sound,
  buildMessages,
  finalWordsDone,
} from '../shared.js';
import Btn from './Btn.vue';
import CanvasControls from './CanvasControls.vue';
import DrawCanvas from './DrawCanvas.vue';
import FinalRoundCanvasOverlay from './FinalRoundCanvasOverlay.vue';
import FinalRoundSidebar from './FinalRoundSidebar.vue';
import MessageLog from './MessageLog.vue';

const props = defineProps({
  userId: { type: String, required: true },
  teamIndex: { type: Number, required: true },
  finalRound: { type: Object, required: true },
  finalRoundStageWithContext: { type: Object, required: true },
  users: { type: Object, required: true },
  teams: { type: Array, required: true },
});
const emit = defineEmits(['client-message', 'canvas-operation', 'audio-cue']);

const guess = ref('');
const color = ref('000000');
const tool = ref('pencil');
const strokeWidth = ref(1);
const canvasWidth = ref();
const canvasHeight = ref();
const canvas = ref();
const guessInput = ref();
const recentGuesses = ref(0);

const states = computed(() => props.finalRound.teamStates[props.teamIndex]);
const wordIndex = computed(() => states.value.length - 1);
const state = computed(() => states.value[wordIndex.value]);
const isDrawer = computed(() => state.value !== undefined && state.value.drawerId === props.userId);
const isTeamDrawing = computed(
  () =>
    props.finalRoundStageWithContext.stage === FinalRoundStage.InProgress &&
    props.finalRoundStageWithContext.areTeamsDrawing[props.teamIndex],
);
const cannotGuess = computed(() => isDrawer.value || !isTeamDrawing.value);
const rateLimited = computed(() => recentGuesses.value >= 3);

// ---- scoreboard figures ----
const status = computed(() => {
  const mine = finalWordsDone(props.finalRound, props.teamIndex);
  const others = props.teams
    .map((_, i) => i)
    .filter((i) => i !== props.teamIndex)
    .map((i) => finalWordsDone(props.finalRound, i));
  const best = Math.max(...others);
  const isWinning = mine !== best ? mine > best : undefined;
  const st = props.finalRoundStageWithContext;
  return {
    isWinning,
    didGuessWord:
      (st.stage === FinalRoundStage.InProgress && !st.areTeamsDrawing[props.teamIndex]) ||
      (st.stage === FinalRoundStage.RoundEnd && isWinning === true),
    scoreDisplay: [mine, ...others].join(' - '),
  };
});

watch(cannotGuess, (disabled) => {
  if (disabled) guess.value = '';
  else guessInput.value?.focus();
});
watch(guess, () => {
  if (cannotGuess.value) guess.value = '';
});
watch(isTeamDrawing, (now, before) => {
  if (now && !before) canvas.value.clearCanvas(true);
  if (!now && before) {
    tool.value = 'pencil';
    color.value = '000000';
    strokeWidth.value = 1;
    canvas.value.resetDrawer();
  }
});

for (const op of state.value.canvasOperations) {
  if (op[0] === Op.ChangeTool) tool.value = op[1];
  else if (op[0] === Op.ChangeColor) color.value = op[1];
  else if (op[0] === Op.ChangeStrokeWidth) strokeWidth.value = op[1];
}
const sendOp = (op) => {
  if (isDrawer.value) emit('canvas-operation', op);
};
const onPathStart = (p) => sendOp([Op.PathStart, p]);
const onPathMove = (p) => sendOp([Op.PathMove, p]);
const onPathEnd = () => sendOp([Op.PathEnd]);
const onCanvasDimensions = (d) => {
  canvasWidth.value = d.width;
  canvasHeight.value = d.height;
};
function onColorClick(c) {
  color.value = c;
  sendOp([Op.ChangeColor, c]);
  if (tool.value === 'eraser') {
    tool.value = 'pencil';
    sendOp([Op.ChangeTool, tool.value]);
  }
}
function onPencilClick() {
  tool.value = 'pencil';
  sendOp([Op.ChangeTool, tool.value]);
}
function onEraserClick() {
  tool.value = 'eraser';
  sendOp([Op.ChangeTool, tool.value]);
}
function onStrokeWidthClick(w) {
  strokeWidth.value = w;
  sendOp([Op.ChangeStrokeWidth, w]);
}
function onClearClick() {
  canvas.value.onClearClick();
  sendOp([Op.ClearCanvas]);
}

// audio cues for the countdown stages
watch(
  () => props.finalRoundStageWithContext,
  (now, before) => {
    if (now.stage === FinalRoundStage.StartCountdown) emit('audio-cue', Sound.BeepLow);
    if (before.stage === FinalRoundStage.StartCountdown && now.stage === FinalRoundStage.InProgress) {
      emit('audio-cue', Sound.BeepHigh);
    }
  },
);

onMounted(() => guessInput.value?.focus());

defineExpose({
  processMessage(msg) {
    if (msg[0] === S.CanvasOperation) {
      const [, idx, teamIdx, op] = msg;
      if (!Array.isArray(idx)) throw new Error('Unexpected roundIndexInput in FinalRound processMessage');
      if (props.teamIndex === teamIdx && wordIndex.value === idx[0]) canvas.value?.processOperation(op);
    }
  },
});

const messages = computed(() => {
  const out = [];
  states.value.forEach((st, i) => {
    out.push(
      ...buildMessages(props.users[st.drawerId], props.finalRound.words[i], st.guesses, st.startTime, [
        MessageKind.Drawer,
      ]),
    );
  });
  return out;
});

const overlaySize = computed(() => (canvasWidth.value !== undefined && canvasWidth.value <= 480 ? 1 : 0));
const trimmedGuess = computed(() => guess.value.trim());
const tooLong = computed(() => trimmedGuess.value.length > MAX_GUESS_LENGTH);
const team = computed(() => props.teams[props.teamIndex]);

function submitGuess() {
  if (rateLimited.value) return;
  const g = trimmedGuess.value;
  if (cannotGuess.value || g === '') return;
  guess.value = '';
  emit('client-message', [C.UserGuess, [wordIndex.value], g]);
  recentGuesses.value++;
  setTimeout(() => {
    recentGuesses.value--;
  }, 3000);
}
</script>

<template>
  <div class="mp-main mp-final">
    <div class="mp-left">
      <div class="mp-pane-header">
        <div v-if="finalRoundStageWithContext.stage === FinalRoundStage.PreStartCountdown" />
        <div v-else-if="status.didGuessWord" class="mp-correct-word">{{ finalRound.words[wordIndex - 1] }}</div>
        <div v-else-if="isDrawer" class="mp-header-word">{{ finalRound.words[wordIndex] }}</div>
        <div v-else class="mp-blank-line" />
        <div
          class="mp-score-display"
          :class="{ winning: status.isWinning === true, losing: status.isWinning === false }"
        >
          {{ status.scoreDisplay }}
        </div>
      </div>
      <div class="mp-canvas-container">
        <DrawCanvas
          ref="canvas"
          :drawer-tool="tool"
          :drawer-color="color"
          :drawer-stroke-width="strokeWidth"
          :canvas-operations="state !== undefined ? state.canvasOperations : []"
          :team-index="teamIndex"
          :is-drawer="isDrawer"
          :show-start-drawing-message="isDrawer"
          :did-guess-word="status.didGuessWord"
          @path-start="onPathStart"
          @path-move="onPathMove"
          @path-end="onPathEnd"
          @canvas-dimensions="onCanvasDimensions"
        >
          <FinalRoundCanvasOverlay
            :user-id="userId"
            :teams="teams"
            :team-index="teamIndex"
            :final-round="finalRound"
            :final-round-stage-with-context="finalRoundStageWithContext"
            :users="users"
            :is-winning="status.isWinning"
            :score="status.scoreDisplay"
            :size="overlaySize"
          />
        </DrawCanvas>
      </div>
    </div>

    <div class="mp-guess-pane">
      <div class="mp-pane-header mp-right-header">
        <div>{{ team.name }}</div>
      </div>
      <div
        class="mp-guesses"
        :class="{ guesser: !isDrawer }"
        :style="{ maxHeight: canvasHeight !== undefined ? `${canvasHeight}px` : '' }"
      >
        <CanvasControls
          :style="{ display: isDrawer || canvasHeight === undefined || canvasHeight >= 256 ? undefined : 'none' }"
          class="mp-canvas-controls"
          :class="{ disabled: !isDrawer }"
          :drawer-tool="tool"
          :drawer-color="color"
          :drawer-stroke-width="strokeWidth"
          @color-click="onColorClick"
          @pencil-click="onPencilClick"
          @eraser-click="onEraserClick"
          @stroke-width-click="onStrokeWidthClick"
          @clear-click="onClearClick"
        />
        <MessageLog class="mp-message-log" :messages="messages" :team="team" :users="users" />
        <div class="mp-guess-form-wrapper">
          <form
            :style="{ display: !isDrawer || canvasHeight === undefined || canvasHeight >= 256 ? '' : 'none' }"
            class="mp-guess-form"
            :class="{ disabled: isDrawer }"
            @submit.prevent="submitGuess"
          >
            <div class="mp-guess-input-wrapper">
              <input
                ref="guessInput"
                v-model="guess"
                type="text"
                placeholder="type your guess..."
                class="mp-guess-input"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                @paste.prevent
              />
            </div>
            <div class="mp-guess-button-wrapper">
              <Btn :disabled="cannotGuess || trimmedGuess === '' || tooLong || rateLimited" :force-rotation="0" size="small">
                guess
              </Btn>
            </div>
          </form>
          <div v-if="tooLong" class="mp-guess-too-long">guess too long!</div>
        </div>
      </div>
    </div>

    <div class="mp-side-pane">
      <div class="mp-side-divider" />
      <div class="mp-side-content">
        <FinalRoundSidebar :team-index="teamIndex" :final-round="finalRound" :teams="teams" />
      </div>
    </div>
  </div>
</template>
