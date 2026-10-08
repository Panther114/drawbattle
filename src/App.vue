<script setup>
import { onMounted } from 'vue';
import QuickSwitchOverlay from './components/QuickSwitchOverlay.vue';
import { setArmed } from './quickswitch.js';

// quick switch works on every page, so it is switched on for the whole app
onMounted(() => setArmed(true));
</script>

<template>
  <router-view v-slot="{ Component, route }">
    <component :is="Component" :key="route.params.gameId ? String(route.params.gameId).toLowerCase() : route.path" />
  </router-view>
  <QuickSwitchOverlay />
</template>
