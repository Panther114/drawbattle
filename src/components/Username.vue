<script setup>
import { inject } from 'vue';
import { UserStatus, displayName } from '../shared.js';
defineProps({ user: { type: Object, required: true } });
const isGameOver = inject('isGameOver', undefined);
</script>

<template>
  <span class="username">
    {{ displayName(user) }}
    <span
      v-if="isGameOver?.value !== true && user.status === UserStatus.Disconnected"
      v-tooltip="'disconnected'"
      class="disconnect-icon"
    />
  </span>
</template>
