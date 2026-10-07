<script setup>
import { computed, ref } from 'vue';
import TeamBoard from '../components/TeamBoard.vue';

// developer page: paste raw canvas operations and see them replayed in a team board
const text = ref('');
const A = '6aa6406d-126b-47a6-9427-7a7c9fa64baa';
const B = '46dd9d3f-1c81-45e3-a147-3870503b4e0b';
const users = {
  [A]: { id: A, name: 'T1P1', status: 1 },
  [B]: { id: B, name: 'T1P2', status: 1 },
};
const team = { name: 'team 1', userIds: [A, B] };
const state = computed(() => {
  try {
    return { drawerId: A, canvasOperations: JSON.parse(text.value), guesses: [] };
  } catch {
    return undefined;
  }
});
</script>

<template>
  <div class="dbg-root">
    <div class="dbg-section">
      <div class="dbg-header">test canvas messages</div>
      <textarea v-model="text" rows="4" cols="50" />
      <TeamBoard
        v-if="state"
        class="dbg-team-board"
        :users="users"
        :team="team"
        :team-state="state"
        :drawing-stage-start-time="0"
        word="word"
        :show-message-log="false"
      />
      <div v-else>waiting for valid json...</div>
    </div>
  </div>
</template>
