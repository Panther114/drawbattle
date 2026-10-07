<script setup>
import { computed } from 'vue';
import { finalWordsDone } from '../shared.js';

const props = defineProps({
  teamIndex: { type: Number },
  finalRound: { type: Object, required: true },
  teams: { type: Array, required: true },
});

// the viewer's own team first
const columns = computed(() => {
  const cols = props.teams.map((team, index) => ({ index, team }));
  if (props.teamIndex !== undefined) {
    const own = cols[props.teamIndex];
    cols.splice(props.teamIndex, 1);
    cols.unshift(own);
  }
  return cols;
});
</script>

<template>
  <table class="sb-table">
    <tbody>
      <tr>
        <td v-for="c in columns" :key="c.index" class="header">{{ c.team.name }}</td>
      </tr>
      <tr v-for="(word, wi) in finalRound.words" :key="wi">
        <td v-for="c in columns" :key="c.index">
          <div v-if="finalWordsDone(finalRound, c.index) <= wi" class="sb-blank" />
          <div v-else-if="teamIndex === undefined || c.index === teamIndex" class="sb-word">{{ word }}</div>
          <div v-else class="sb-check" />
        </td>
      </tr>
    </tbody>
  </table>
</template>
