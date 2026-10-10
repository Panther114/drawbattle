<script setup>
import { useRouter } from 'vue-router';
import { toggleHelp, useKeys } from '../keys.js';
import Icon from './Icon.vue';
import KeyHint from './KeyHint.vue';
import ThemeToggle from './ThemeToggle.vue';

const router = useRouter();
// my stats is one key away from every page (leaving a game this way asks first, like any other way out)
useKeys([{ key: 's', when: () => router.currentRoute.value.name !== 'Stats', run: () => router.push('/stats') }]);
</script>

<template>
  <nav class="top-nav">
    <slot />
    <router-link v-if="$route.name !== 'Stats'" to="/stats" class="nav-stats"><Icon name="chart" />my stats<KeyHint k="s" /></router-link>
    <router-link v-if="$route.name !== 'QuickSwitch'" to="/quick-switch" class="nav-quick"><Icon name="bolt" />quick switch</router-link>
    <a href="https://github.com/Panther114/drawbattle" target="_blank" rel="noopener noreferrer" class="nav-github"><Icon name="code" />github</a>
    <ThemeToggle label />
    <button type="button" class="nav-keys" @click="toggleHelp"><Icon name="keyboard" />shortcuts<KeyHint k="?" /></button>
  </nav>
</template>
