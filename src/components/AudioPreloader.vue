<script setup>
import { SOUND_URLS } from '../audio.js';
</script>

<template>
  <div>
    <audio v-for="(url, key) in SOUND_URLS" :key="key" :src="url" preload="auto" />
  </div>
</template>
