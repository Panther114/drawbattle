<script setup>
import { displayName } from '../shared.js';
import CanvasOverlay from './CanvasOverlay.vue';
import IconWithText from './IconWithText.vue';

defineProps({
  userId: { type: String, required: true },
  round: { type: Object, required: true },
  roundStageSecondsRemaining: { type: Number, required: true },
  users: { type: Object, required: true },
  size: { type: Number, required: true },
});
</script>

<template>
  <div v-if="round.chooserId === userId" class="rh-chooser-overlay">
    <IconWithText icon="headstartClock" color="yellow">{{ roundStageSecondsRemaining }}</IconWithText>
  </div>
  <CanvasOverlay v-else :size="size" :class="{ 'rh-small': size === 1 }">
    <div>
      <div class="rh-title">{{ displayName(users[round.chooserId]) }}'s head start</div>
      <div class="rh-timer">
        <div class="rh-timer-icon" />
        <div :key="roundStageSecondsRemaining" class="m-tick">{{ roundStageSecondsRemaining }}</div>
      </div>
    </div>
  </CanvasOverlay>
</template>
