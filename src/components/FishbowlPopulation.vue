<script setup>
import { computed, ref } from 'vue';
import { C } from '../shared.js';
import Btn from './Btn.vue';

const props = defineProps({
  numUsers: { type: Number, required: true },
  numRounds: { type: Number, required: true },
  fishbowlWords: { type: Object, required: true },
  userId: { type: String, required: true },
  startGameSecondsRemaining: { type: Number },
});
const emit = defineEmits(['client-message']);

const text = ref(props.fishbowlWords[props.userId] !== undefined ? props.fishbowlWords[props.userId].join('\n') : '');
const wordsPerUser = computed(() => Math.ceil((2 * props.numRounds) / props.numUsers));
const words = computed(() =>
  text.value
    .split('\n')
    .map((w) => w.trim())
    .filter((w) => w !== ''),
);
const submitted = computed(() => props.fishbowlWords[props.userId] !== undefined);
</script>

<template>
  <div>
    <form @submit.prevent="emit('client-message', [C.SubmitFishbowlWords, words])">
      <div class="fb-label">enter {{ wordsPerUser }} words</div>
      <div>
        <textarea v-model="text" placeholder="1 word per line..." :disabled="submitted" class="fb-input" />
      </div>
      <Btn class="fb-submit" :force-rotation="-1" :disabled="words.length !== wordsPerUser || submitted">
        {{
          startGameSecondsRemaining !== undefined
            ? `starting in ${startGameSecondsRemaining}...`
            : submitted
              ? 'waiting for others...'
              : 'submit words!'
        }}
      </Btn>
    </form>
  </div>
</template>
