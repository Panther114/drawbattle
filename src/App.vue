<script setup>
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import KeysHelp from './components/KeysHelp.vue';
import QuickSwitchOverlay from './components/QuickSwitchOverlay.vue';
import { Prio, keys, toggleHelp, useKeys } from './keys.js';
import { setArmed } from './quickswitch.js';
import { toggleTheme } from './theme.js';

// quick switch works on every page, so it is switched on for the whole app
onMounted(() => setArmed(true));

// keys that work on every page
const route = useRoute();
const router = useRouter();
const onSidePage = () => !['Home', 'Wordpack', 'Game'].includes(route.name);
useKeys([
  { key: '?', run: toggleHelp },
  { key: 't', run: () => toggleTheme() },
  // the pages around the game lead back home (Esc comes last, so a field or a dialog gets it first)
  { key: 'h', when: onSidePage, run: () => router.push('/') },
  { key: 'esc', prio: Prio.fallback - 5, when: onSidePage, run: () => router.push('/') },
]);
</script>

<template>
  <router-view v-slot="{ Component, route }">
    <Transition name="page" mode="out-in" appear>
      <component :is="Component" :key="route.params.gameId ? String(route.params.gameId).toLowerCase() : route.path" />
    </Transition>
  </router-view>
  <QuickSwitchOverlay />
  <KeysHelp v-if="keys.help" />
</template>
