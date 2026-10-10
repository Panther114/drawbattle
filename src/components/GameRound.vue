<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import {
  C,
  rules,
  hintedWord,
  MAX_GUESS_LENGTH,
  Op,
  RoundStage,
  S,
  Sound,
  bothGuessedTime,
  buildMessages,
  drawingStartTime,
  findCorrectGuess,
  formatClock,
  MessageKind,
  redactWord,
} from '../shared.js';
import Btn from './Btn.vue';
import CanvasControls from './CanvasControls.vue';
import DrawCanvas from './DrawCanvas.vue';
import MessageLog from './MessageLog.vue';
import OtherTeamView from './OtherTeamView.vue';
import RoundCanvasOverlay from './RoundCanvasOverlay.vue';

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
  gameSettings: { type: Object, required: true },
});
const emit = defineEmits(['client-message', 'canvas-operation', 'audio-cue']);

const guess = ref('');
const color = ref('000000');
const tool = ref('pencil');
const strokeWidth = ref(1);
const canvasWidth = ref();
const canvasHeight = ref();
const mainCanvas = ref();
const otherCanvases = props.teams.map(() => ref());
const guessInput = ref();
const recentGuesses = ref(0);

const isChooser = computed(() => props.round.chooserId === props.userId);
const guessedTime = computed(() => bothGuessedTime(props.round));
const rateLimited = computed(() => recentGuesses.value >= 3);

// time shown in the header
const clock = computed(() => {
  const roundLength = props.gameSettings.roundLengthSec;
  let t = roundLength;
  if (props.roundStage === RoundStage.Drawing) t = props.roundStageSecondsRemaining;
  else if (props.roundStage === RoundStage.DrawingEnd) {
    if (guessedTime.value !== undefined) {
      const elapsed =
        guessedTime.value -
        (props.round.wordChosenTime + 1000 * (props.round.chooserHeadStartSeconds + rules.drawingCountdownSec));
      t = Math.ceil(roundLength - elapsed / 1000);
    } else t = 0;
  }
  return formatClock(t);
});

onMounted(() => guessInput.value?.focus());

defineExpose({
  processMessage(msg) {
    if (msg[0] === S.CanvasOperation) {
      const [, , teamIdx, op] = msg;
      if (props.teamIndex === teamIdx) mainCanvas.value?.processOperation(op);
      else otherCanvases[teamIdx]?.value?.processOperation(op);
    }
  },
});

// restore tool state from earlier operations (reconnect)
for (const op of props.round.teamStates[props.teamIndex].canvasOperations) {
  if (op[0] === Op.ChangeTool) tool.value = op[1];
  else if (op[0] === Op.ChangeColor) color.value = op[1];
  else if (op[0] === Op.ChangeStrokeWidth) strokeWidth.value = op[1];
}
const sendOp = (op) => emit('canvas-operation', op);
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
  mainCanvas.value.onClearClick();
  sendOp([Op.ClearCanvas]);
}

// audio cues driven by stage changes
watch(
  () => props.roundStage,
  (stage) => {
    const headStart = isChooser.value && props.round.chooserHeadStartSeconds > 0;
    if ((headStart && stage === RoundStage.DrawingHeadStart) || (!headStart && stage === RoundStage.Drawing)) {
      emit('audio-cue', Sound.BeepHigh);
    } else if (stage === RoundStage.DrawingEnd && guessedTime.value === undefined) {
      emit('audio-cue', Sound.Buzzer);
    }
  },
);
watch([() => props.roundStage, () => props.roundStageSecondsRemaining], ([stage, secs]) => {
  const countdown =
    stage === RoundStage.DrawingCountdown && (isChooser.value || props.round.chooserHeadStartSeconds === 0);
  const waiting = stage === RoundStage.DrawingHeadStart && !isChooser.value;
  const lastSeconds = stage === RoundStage.Drawing && secs <= 5;
  if (countdown || waiting) emit('audio-cue', Sound.BeepLow);
  else if (lastSeconds) emit('audio-cue', Sound.ClockTick);
});

const myState = computed(() => props.round.teamStates[props.teamIndex]);
const messages = computed(() =>
  buildMessages(
    props.users[myState.value.drawerId],
    props.round.word,
    myState.value.guesses,
    drawingStartTime(props.round, props.teamIndex),
    [MessageKind.Drawer, MessageKind.Guessers],
  ),
);
const didGuess = computed(() => findCorrectGuess(myState.value.guesses, props.round.word) !== undefined);
const isDrawer = computed(() => props.users[myState.value.drawerId].id === props.userId);
const isGuesser = computed(() => !isDrawer.value && !didGuess.value);
const shownWord = computed(() => {
  const w = props.round.word;
  if (!w) return '';
  if (!isGuesser.value) return w;
  const every = rules.hintIntervalSec;
  if (every > 0 && props.roundStage === RoundStage.Drawing) {
    const elapsed = props.gameSettings.roundLengthSec - props.roundStageSecondsRemaining;
    return hintedWord(w, Math.floor(elapsed / every));
  }
  return redactWord(w);
});
const trimmedGuess = computed(() => guess.value.trim());
const tooLong = computed(() => trimmedGuess.value.length > MAX_GUESS_LENGTH);
const team = computed(() => props.teams[props.teamIndex]);
const canDraw = computed(
  () =>
    (props.roundStage === RoundStage.DrawingHeadStart && isChooser.value) ||
    (props.roundStage === RoundStage.Drawing && !didGuess.value),
);
const overlaySize = computed(() => (canvasWidth.value !== undefined && canvasWidth.value <= 480 ? 1 : 0));
const otherTeams = computed(() =>
  props.teams
    .map((t, i) => ({ teamIndex: i, team: t, teamState: props.round.teamStates[i] }))
    .filter((_, i) => i !== props.teamIndex),
);

function submitGuess() {
  if (rateLimited.value) return;
  const g = trimmedGuess.value;
  if (props.roundStage !== RoundStage.Drawing || g === '' || g.length > MAX_GUESS_LENGTH) return;
  guess.value = '';
  emit('client-message', [C.UserGuess, props.roundIndex, g]);
  recentGuesses.value++;
  setTimeout(() => {
    recentGuesses.value--;
  }, 3000);
}
</script>

<template>
  <div class="mp-main mp-round">
    <div class="mp-left">
      <div class="mp-pane-header">
        <div v-if="isGuesser && gameSettings.hideWordLength" class="mp-blank-line" />
        <div v-else :class="isGuesser ? 'mp-redacted' : 'mp-header-word'" class="" :data-did="didGuess">
          <span :class="{ 'mp-did-guess': didGuess }">{{ shownWord }}</span>
        </div>
        <div class="mp-drawing-countdown">{{ clock }}</div>
      </div>
      <div class="mp-canvas-container">
        <DrawCanvas
          ref="mainCanvas"
          :drawer-tool="tool"
          :drawer-color="color"
          :drawer-stroke-width="strokeWidth"
          :hide-content="roundStage === RoundStage.DrawingHeadStart && !isChooser"
          :canvas-operations="myState.canvasOperations"
          :team-index="teamIndex"
          :is-drawer="isDrawer"
          :show-start-drawing-message="isDrawer && roundStage === RoundStage.Drawing"
          :can-drawer-draw="canDraw"
          :did-guess-word="didGuess"
          @path-start="onPathStart"
          @path-move="onPathMove"
          @path-end="onPathEnd"
          @canvas-dimensions="onCanvasDimensions"
        >
          <RoundCanvasOverlay
            :user-id="userId"
            :team-index="teamIndex"
            :round-index="roundIndex"
            :round="round"
            :round-stage="roundStage"
            :round-stage-seconds-remaining="roundStageSecondsRemaining"
            :previous-rounds="previousRounds"
            :users="users"
            :teams="teams"
            :size="overlaySize"
            @client-message="(m) => emit('client-message', m)"
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
          v-if="isDrawer"
          class="mp-canvas-controls"
          :drawer-tool="tool"
          :drawer-color="color"
          :drawer-stroke-width="strokeWidth"
          @color-click="onColorClick"
          @pencil-click="onPencilClick"
          @eraser-click="onEraserClick"
          @stroke-width-click="onStrokeWidthClick"
          @clear-click="onClearClick"
        />
        <MessageLog
          v-if="canvasHeight !== undefined"
          class="mp-message-log"
          :messages="messages"
          :team="team"
          :users="users"
        />
        <div v-if="!isDrawer" class="mp-guess-form-wrapper">
          <form class="mp-guess-form" @submit.prevent="submitGuess">
            <div class="mp-guess-input-wrapper">
              <input
                ref="guessInput"
                v-model="guess"
                type="text"
                placeholder="type your guess... (/ for chat)"
                class="mp-guess-input"
                spellcheck="false"
                autocapitalize="off"
                autocorrect="off"
                @paste.prevent
              />
            </div>
            <div class="mp-guess-button-wrapper">
              <Btn
                :disabled="roundStage !== RoundStage.Drawing || trimmedGuess === '' || tooLong || rateLimited"
                :force-rotation="0"
                size="small"
              >
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
        <OtherTeamView
          v-for="o in otherTeams"
          :key="o.teamIndex"
          :ref="(el) => (otherCanvases[o.teamIndex].value = el)"
          :round="round"
          :round-stage="roundStage"
          :team-index="o.teamIndex"
          :team="o.team"
          :team-state="o.teamState"
          :word="round.word"
          :users="users"
          :show-full-view="didGuess"
        />
      </div>
    </div>
  </div>
</template>
