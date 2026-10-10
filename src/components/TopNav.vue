<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { toggleHelp, useKeys } from '../keys.js';
import Icon from './Icon.vue';
import KeyHint from './KeyHint.vue';
import ThemeToggle from './ThemeToggle.vue';

const router = useRouter();
// inside a game these letters belong to the game (S spectate / switch teams, G show guesses), and leaving goes through Q
const inGame = computed(() => router.currentRoute.value.name === 'Game');
useKeys([
  { key: 's', when: () => !inGame.value && router.currentRoute.value.name !== 'Stats', run: () => router.push('/stats') },
  { key: 'z', when: () => !inGame.value && router.currentRoute.value.name !== 'QuickSwitch', run: () => router.push('/quick-switch') },
  { key: 'g', when: () => !inGame.value, run: () => window.open('https://github.com/Panther114/drawbattle', '_blank', 'noopener,noreferrer') },
]);
</script>

<template>
  <nav class="top-nav">
    <slot />
    <router-link v-if="$route.name !== 'Stats'" to="/stats" class="nav-stats"><Icon name="chart" />my stats<KeyHint v-if="!inGame" k="s" /></router-link>
    <router-link v-if="$route.name !== 'QuickSwitch'" to="/quick-switch" class="nav-quick"><Icon name="bolt" />quick switch<KeyHint v-if="!inGame" k="z" /></router-link>
    <a href="https://github.com/Panther114/drawbattle" target="_blank" rel="noopener noreferrer" class="nav-github"><Icon name="code" />github<KeyHint v-if="!inGame" k="g" /></a>
    <ThemeToggle label />
    <button type="button" class="nav-keys" @click="toggleHelp"><Icon name="keyboard" />shortcuts<KeyHint k="?" /></button>
  </nav>
</template>
