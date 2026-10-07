<script setup>
import { UserStatus, displayName } from '../shared.js';
import Btn from './Btn.vue';

defineProps({ users: { type: Object, required: true } });
defineEmits(['join-game', 'spectate-game']);
</script>

<template>
  <div class="jd-root">
    <div class="jd-title">game in progress!</div>
    <template v-for="u in users" :key="u.id">
      <div v-if="u.status === UserStatus.Disconnected">
        <Btn class="jd-join" @click="$emit('join-game', u.id)">rejoin as {{ displayName(u) }}</Btn>
      </div>
    </template>
    <div>
      <a href="#" class="spectate-link" @click.prevent="$emit('spectate-game')">join as spectator</a>
    </div>
  </div>
</template>
