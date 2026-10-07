<script setup>
import Username from './Username.vue';
defineProps({ guessers: { type: Array, required: true } });
</script>

<template>
  <div v-if="guessers.length === 1"><Username :user="guessers[0]" /> is guessing</div>
  <div v-else-if="guessers.length === 2">
    <Username :user="guessers[0]" /> and <Username :user="guessers[1]" /> are guessing
  </div>
  <div v-else-if="guessers.length > 2">
    <span v-for="(g, i) in guessers" :key="i">
      <template v-if="i !== guessers.length - 1"><Username :user="g" />, </template>
      <template v-else>and <Username :user="g" /> are guessing</template>
    </span>
  </div>
  <div v-else />
</template>
