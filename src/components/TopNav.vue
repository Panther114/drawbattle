<script setup>
import Icon from './Icon.vue';
import ThemeToggle from './ThemeToggle.vue';
</script>

<template>
  <nav class="top-nav">
    <slot />
    <router-link v-if="$route.name !== 'Stats'" to="/stats" class="nav-stats"><Icon name="chart" />my stats</router-link>
    <router-link v-if="$route.name !== 'QuickSwitch'" to="/quick-switch" class="nav-quick"><Icon name="bolt" />quick switch</router-link>
    <a href="https://github.com/Panther114/drawbattle" target="_blank" rel="noreferrer" class="nav-github"><Icon name="code" />github</a>
    <ThemeToggle label />
  </nav>
</template>
