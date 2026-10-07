<script setup>
import { ref } from 'vue';
import { C, RoundStage, displayName, roundWinner, winStreak } from '../shared.js';
import Btn from './Btn.vue';
import CanvasOverlay from './CanvasOverlay.vue';
import IconWithText from './IconWithText.vue';

const props = defineProps({
  userId: { type: String, required: true },
  teamIndex: { type: Number, required: true },
  roundIndex: { type: Number, required: true },
  round: { type: Object, required: true },
  roundStage: { type: Number, required: true },
  roundStageSecondsRemaining: { type: Number, required: true },
  previousRounds: { type: Array, required: true },
  users: { type: Object, required: true },
  size: { type: Number, required: true },
});
const emit = defineEmits(['client-message']);

const chosenLock = ref(false);
const ROTATIONS = [-3, 2];

const isChosen = (i) => Boolean(props.round.word && props.round.word === props.round.wordChoices[i]);
const isNotChosen = (i) => Boolean(props.round.word && props.round.word !== props.round.wordChoices[i]);

function chooseWord(i) {
  if (props.round.word || chosenLock.value) return;
  emit('client-message', [C.ChooseWord, props.roundIndex, props.round.wordChoices[i]]);
  chosenLock.value = true;
  setTimeout(() => {
    chosenLock.value = false;
  }, 2000);
}

function streakInfo() {
  const drawers = props.round.teamStates.map((t) => t.drawerId);
  const prev = props.previousRounds;
  const winner = prev.length === 0 ? undefined : roundWinner(prev[prev.length - 1]);
  return { winner, streak: winStreak(prev, drawers) };
}
</script>

<template>
  <CanvasOverlay
    :size="size"
    :class="{
      'rs-small': size === 1,
      'rs-is-chooser': round.chooserId === userId,
    }"
  >
    <template #default>
      <template v-if="round.teamStates[teamIndex].drawerId === userId">
        <div class="rs-title">
          {{ round.chooserId === userId ? 'choose a word' : `${displayName(users[round.chooserId])} is choosing...` }}
        </div>
        <div class="rs-choices">
          <template v-if="round.chooserId === userId">
            <div v-for="(w, i) in round.wordChoices" :key="i" class="rs-choice-wrapper">
              <Btn
                type="submit"
                :force-rotation="ROTATIONS[i]"
                :disabled="isNotChosen(i)"
                :word-choice-button="true"
                :class="{ 'rs-choice-disabled': isNotChosen(i) }"
                @click="chooseWord(i)"
              >
                {{ w }}
              </Btn>
              <div v-if="isChosen(i)" class="rs-arrow" />
            </div>
          </template>
          <template v-else>
            <div
              v-for="(w, i) in round.wordChoices"
              :key="i"
              class="rs-choice"
              :class="{ 'not-chosen': isNotChosen(i) }"
              :style="{ transform: `rotate(${ROTATIONS[i]}deg)` }"
            >
              {{ w }}
              <div v-if="isChosen(i)" class="rs-arrow" />
            </div>
          </template>
        </div>
      </template>
      <div v-else class="rs-drawer-names">
        <template v-for="(ts, i) in round.teamStates" :key="i">
          <div class="rs-drawer-name">
            <div>{{ displayName(users[ts.drawerId]) }}</div>
            <IconWithText
              v-if="i === streakInfo().winner && streakInfo().streak >= 2"
              icon="trophy"
              color="yellow"
              :hide-icon-on-small-viewport="true"
            >
              {{ streakInfo().streak }}x streak
            </IconWithText>
            <IconWithText
              v-if="ts.drawerId === round.chooserId && round.chooserHeadStartSeconds > 0"
              icon="headstartClock"
              color="yellow"
              :hide-icon-on-small-viewport="true"
            >
              {{ round.chooserHeadStartSeconds }}s head start
            </IconWithText>
          </div>
          <div v-if="i < round.teamStates.length - 1" class="rs-duel-icon" />
        </template>
      </div>
    </template>

    <template #topLeft>
      <IconWithText
        v-if="round.teamStates[teamIndex].drawerId === userId && round.chooserHeadStartSeconds > 0"
        icon="headstartClock"
        color="yellow"
        class="rs-headstart-text"
      >
        {{ round.chooserHeadStartSeconds }}s head start
      </IconWithText>
    </template>

    <template #topRight>
      <div
        v-if="
          round.teamStates[teamIndex].drawerId === userId &&
          (roundStage === RoundStage.ChooseWord ||
            (roundStage === RoundStage.DrawingCountdown &&
              (round.chooserId === userId || round.chooserHeadStartSeconds === 0) &&
              size === 1))
        "
        class="rs-top-right-countdown"
      >
        {{ roundStageSecondsRemaining }}
      </div>
    </template>

    <template #bottom>
      <div
        v-if="
          round.teamStates[teamIndex].drawerId !== userId &&
          (roundStage === RoundStage.ChooseWord ||
            (roundStage === RoundStage.DrawingCountdown && round.chooserHeadStartSeconds > 0))
        "
        class="rs-choosing-text"
      >
        {{ displayName(users[round.chooserId]) }} is choosing a word...
      </div>
      <div
        v-else-if="
          roundStage === RoundStage.DrawingCountdown &&
          (round.chooserId === userId || round.chooserHeadStartSeconds === 0) &&
          !(size === 1 && round.teamStates[teamIndex].drawerId === userId)
        "
        class="rs-draw-countdown"
      >
        {{ roundStageSecondsRemaining }}
      </div>
    </template>
  </CanvasOverlay>
</template>
