<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { API } from '../wordpacks.js';
import { useKeys } from '../keys.js';
import Btn from '../components/Btn.vue';
import Icon from '../components/Icon.vue';
import KeyHint from '../components/KeyHint.vue';
import TopNav from '../components/TopNav.vue';

const router = useRouter();
const lobbies = ref([]);
const loaded = ref(false);
const failed = ref(false);
let timer;

async function refresh() {
  try {
    const res = await fetch(`${API}/lobbies`);
    if (res.status === 200) {
      lobbies.value = await res.json();
      failed.value = false;
    } else failed.value = true;
  } catch {
    failed.value = true;
  }
  loaded.value = true;
}
onMounted(() => {
  void refresh();
  timer = window.setInterval(refresh, 3000);
});
onUnmounted(() => clearInterval(timer));

function progress(l) {
  switch (l.stage) {
    case 'lobby':
      return l.players.length < 4 ? 'waiting for players' : 'in the lobby';
    case 'starting':
      return 'starting...';
    case 'final':
      return 'final drawdown!';
    case 'ended':
      return 'finished';
    default:
      return `round ${Math.min(l.round, l.numRounds)} of ${l.numRounds}`;
  }
}
const pct = (l) => {
  if (l.stage === 'final' || l.stage === 'ended') return 100;
  if (l.stage === 'playing') return Math.round((Math.max(l.round - 1, 0) / (l.numRounds + 1)) * 100);
  return 0;
};
const join = (l) => router.push({ name: 'Game', params: { gameId: l.id.toUpperCase() } });
const spectate = (l) => router.push({ name: 'Game', params: { gameId: l.id.toUpperCase() }, query: { spectate: '1' } });

// 1-9 join the lobby on that row, Shift+1-9 watch it
useKeys(
  [1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((n) => [
    { key: String(n), when: () => lobbies.value[n - 1]?.canJoin, run: () => join(lobbies.value[n - 1]) },
    { key: `shift+${n}`, when: () => lobbies.value[n - 1]?.canSpectate, run: () => spectate(lobbies.value[n - 1]) },
  ]),
);
</script>

<template>
  <div class="lb-root">
    <TopNav><router-link to="/" class="nav-home"><Icon name="home" />back to home<KeyHint k="h" /></router-link></TopNav>
    <div class="lb-title">lobbies</div>
    <div class="lb-sub">every open game right now. hop in, or watch from the sidelines</div>
    <div v-if="failed" class="lb-note lb-error">couldn't reach the server, retrying...</div>
    <div v-else-if="loaded && lobbies.length === 0" class="lb-note">no games yet. start one and be the first!</div>
    <TransitionGroup name="lb-list" tag="div" class="lb-list">
      <div v-for="(l, i) in lobbies" :key="l.id" class="lb-card" :style="{ '--tilt': `${i % 2 ? 0.3 : -0.3}deg` }">
        <div class="lb-card-head">
          <span class="lb-code">{{ l.id.toUpperCase() }}</span>
          <span class="lb-progress" :class="l.stage">{{ progress(l) }}</span>
          <span class="lb-count">{{ l.players.length }}/{{ l.capacity }} players</span>
        </div>
        <div class="lb-bar"><div class="lb-bar-fill" :style="{ width: pct(l) + '%' }" /></div>
        <div class="lb-players">
          <span
            v-for="(p, pi) in l.players"
            :key="pi"
            class="lb-player"
            :class="['team' + p.team, { off: !p.connected }]"
            :title="l.teamNames[p.team]"
          >
            {{ p.name }}
          </span>
        </div>
        <div class="lb-actions">
          <Btn v-if="l.canJoin" size="small" color="green" :force-rotation="-1" icon="enter" :hint="i < 9 ? String(i + 1) : ''" @click="join(l)">join</Btn>
          <Btn
            size="small"
            color="purple"
            :force-rotation="1"
            :disabled="!l.canSpectate"
            :title="l.canSpectate ? '' : 'this game does not allow spectators'"
            :hint="l.canSpectate && i < 9 ? `shift+${i + 1}` : ''"
            @click="spectate(l)"
          >
            spectate
          </Btn>
          <span v-if="!l.canJoin && l.full && l.stage === 'lobby'" class="lb-hint">lobby is full</span>
          <span v-else-if="!l.canJoin" class="lb-hint">already started</span>
          <span v-if="l.spectators > 0" class="lb-hint">{{ l.spectators }} watching</span>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>
