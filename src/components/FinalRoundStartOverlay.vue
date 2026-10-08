<script setup>
import { computed } from 'vue';
import { FINAL_PRE_START_SEC, FinalRoundStage, displayName, nextDrawer } from '../shared.js';
import CanvasOverlay from './CanvasOverlay.vue';

const props = defineProps({
  userId: { type: String },
  teams: { type: Array, required: true },
  teamIndex: { type: Number, required: true },
  finalRound: { type: Object, required: true },
  finalRoundStage: { type: Number, required: true },
  finalRoundStageSecondsRemaining: { type: Number, required: true },
  users: { type: Object, required: true },
  size: { type: Number, required: true },
});

// description sub-stages while the pre-start countdown runs
const SUB = { Init: 0, Description1: 1, Description2: 2, Description3: 3, Countdown: 4 };
const subStage = computed(() => {
  if (props.finalRoundStage === FinalRoundStage.PreStartCountdown) {
    const e = FINAL_PRE_START_SEC - props.finalRoundStageSecondsRemaining;
    if (e < 1) return SUB.Init;
    if (e < 3) return SUB.Description1;
    if (e < 5) return SUB.Description2;
    if (e < 8) return SUB.Description3;
  }
  return SUB.Countdown;
});
const isVisible = (i) => (i === 0 ? subStage.value >= 1 : i === 1 ? subStage.value >= 2 : i === 2 ? subStage.value >= 3 : false);

const descriptions = computed(() => [
  ['replay', `replay the same ${props.finalRound.words.length} words again`],
  ['pencil', 'team members take turns drawing'],
  ['trophy', 'race to finish before the other team!'],
]);

const states = computed(() => props.finalRound.teamStates[props.teamIndex]);
const word = computed(() => props.finalRound.words[states.value.length - 1]);
const firstDrawer = computed(() => states.value[states.value.length - 1].drawerId);
const nextId = computed(() => nextDrawer(props.teams[props.teamIndex], props.users, firstDrawer.value));
</script>

<template>
  <CanvasOverlay :size="size" :class="{ 'fs-small': size === 1 }">
    <div class="fs-title">the final drawdown!</div>
    <Transition mode="out-in" name="fade">
      <div v-if="subStage === SUB.Countdown" key="countdown">
        <div class="fs-countdown" :class="{ visible: finalRoundStage === FinalRoundStage.StartCountdown }">
          <span :key="finalRoundStageSecondsRemaining" class="m-tick">{{ finalRoundStageSecondsRemaining }}</span>
        </div>
        <div class="fs-bottom-text">
          <template v-if="firstDrawer === userId">
            <div>you're drawing first</div>
            <div class="fs-current-word">{{ word }}</div>
          </template>
          <template v-else>
            <div>{{ displayName(users[firstDrawer]) }} is drawing first</div>
            <div class="fs-bottom-subtext">
              {{ nextId === userId ? "you're next" : `${displayName(users[nextId])} is next` }}
            </div>
          </template>
        </div>
      </div>
      <div v-else key="descriptions">
        <div class="fs-descriptions">
          <div>
            <div v-for="(d, i) in descriptions" :key="i" class="fs-description" :class="{ visible: isVisible(i) }">
              <div class="fs-description-icon" :class="d[0]" />
              <div>{{ d[1] }}</div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </CanvasOverlay>
</template>
