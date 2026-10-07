<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { MessageKind } from '../shared.js';
import Username from './Username.vue';
import GuessersMessage from './GuessersMessage.vue';

const props = defineProps({
  messages: { type: Array, required: true },
  team: { type: Object, required: true },
  users: { type: Object, required: true },
  otherTeamView: { type: Boolean, default: false },
});

const scrolled = ref(false);
const el = ref();

function scrollToEnd() {
  if (el.value) el.value.scrollTop = el.value.scrollHeight;
  scrolled.value = !!el.value && el.value.scrollTop > 0;
}
onMounted(() => {
  scrollToEnd();
  window.addEventListener('resize', scrollToEnd);
});
onUnmounted(() => window.removeEventListener('resize', scrollToEnd));
watch(
  () => props.messages,
  () => nextTick(scrollToEnd),
);

const guessers = (m) => props.team.userIds.filter((id) => id !== m.drawer.id).map((id) => props.users[id]);
</script>

<template>
  <div class="ml-container" :class="{ 'ml-other': otherTeamView }">
    <div ref="el" class="ml-root" @scroll="scrolled = !!el && el.scrollTop > 0">
      <div
        v-for="(m, i) in messages"
        :key="i"
        class="ml-message"
        :class="{ correct: m.type === MessageKind.Guess && m.isCorrect }"
      >
        <template v-if="m.type === MessageKind.Drawer">
          <div class="ml-icon drawer" />
          <div><Username :user="m.drawer" /> is drawing</div>
        </template>
        <template v-else-if="m.type === MessageKind.Guessers">
          <div class="ml-icon log" />
          <GuessersMessage :guessers="guessers(m)" />
        </template>
        <template v-else-if="m.type === MessageKind.Guess">
          <div class="ml-icon guess" :class="{ correct: m.isCorrect }" />
          <div :title="Math.round(m.msElapsed / 100) / 10 + 's elapsed'">
            <Username :user="users[m.guess.userId]" /> guessed
            <span class="ml-guess-text">{{ m.guess.guess }}</span>
          </div>
        </template>
      </div>
    </div>
    <div class="ml-fader" :class="{ show: scrolled }" />
  </div>
</template>
