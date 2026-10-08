<script setup>
import { inject } from 'vue';
import { UserPresence, UserStatus, displayName } from '../shared.js';
defineProps({ user: { type: Object, required: true } });
const isGameOver = inject('isGameOver', undefined);
</script>

<template>
  <span class="username">
    {{ displayName(user) }}<sup v-if="isGameOver?.value !== true && user.rating !== undefined" class="rating">{{ user.rating }}</sup>
    <span
      v-if="isGameOver?.value !== true && user.status === UserStatus.Disconnected"
      v-tooltip="'disconnected'"
      class="disconnect-icon"
    />
    <span
      v-else-if="isGameOver?.value !== true && user.status === UserStatus.Connected && user.presence === UserPresence.Snooze"
      v-tooltip="'snoozing'"
      class="snooze-icon"
    />
    <span
      v-else-if="isGameOver?.value !== true && user.status === UserStatus.Connected && user.presence === UserPresence.Away"
      v-tooltip="'in another window'"
      class="away-icon"
    />
  </span>
</template>
