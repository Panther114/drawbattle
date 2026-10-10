<script setup>
import { theme, toggleTheme } from '../theme.js';
import Icon from './Icon.vue';
import KeyHint from './KeyHint.vue';
defineProps({ label: { type: Boolean, default: false } });
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :class="theme.dark ? 'is-dark' : 'is-light'"
    :aria-label="theme.dark ? 'switch to light mode' : 'switch to dark mode'"
    :aria-pressed="theme.dark"
    @click="toggleTheme($event)"
  >
    <Icon :key="theme.dark ? 'sun' : 'moon'" :name="theme.dark ? 'sun' : 'moon'" class="theme-icon" />
    <span v-if="label">{{ theme.dark ? 'light mode' : 'dark mode' }}</span>
    <KeyHint v-if="label" k="t" />
  </button>
</template>
