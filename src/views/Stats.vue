<script setup>
import { computed, ref } from 'vue';
import { resetStats, stats, summarize } from '../stats.js';
import Icon from '../components/Icon.vue';
import TopNav from '../components/TopNav.vue';

const s = computed(() => summarize(stats.games));
const confirming = ref(false);
const pct = (v) => (v === undefined ? '–' : `${v}%`);
const when = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const label = { win: 'won', loss: 'lost', draw: 'draw' };

function reset() {
  if (!confirming.value) {
    confirming.value = true;
    setTimeout(() => (confirming.value = false), 4000);
    return;
  }
  resetStats();
  confirming.value = false;
}
</script>

<template>
  <div class="stt-root">
    <TopNav><router-link to="/" class="nav-home"><Icon name="home" />back to home</router-link></TopNav>
    <div class="stt-title">my stats</div>
    <div class="stt-sub">kept only in this browser. nothing is sent to the server</div>

    <div class="stt-cards">
      <div class="stt-card">
        <div class="stt-label"><Icon name="list" class="stt-ic c-blue" />games played</div>
        <div class="stt-big">{{ s.played }}</div>
        <div class="stt-note">finished games you took part in</div>
      </div>
      <div class="stt-card">
        <div class="stt-label"><Icon name="sparkle" class="stt-ic c-yellow" />games won</div>
        <div class="stt-big">{{ s.won }}</div>
        <div class="stt-note">{{ pct(s.winRate) }} win rate<template v-if="s.draws"> · {{ s.draws }} draw{{ s.draws === 1 ? '' : 's' }}</template></div>
        <div class="stt-bar"><div class="stt-bar-fill" :style="{ width: (s.winRate ?? 0) + '%' }" /></div>
      </div>
      <div class="stt-card">
        <div class="stt-label"><Icon name="pencil" class="stt-ic c-orange" />win rate as drawer</div>
        <div class="stt-big">{{ pct(s.drawer.rate) }}</div>
        <div class="stt-note">{{ s.drawer.won }} of {{ s.drawer.total }} rounds won</div>
        <div class="stt-bar"><div class="stt-bar-fill" :style="{ width: (s.drawer.rate ?? 0) + '%' }" /></div>
      </div>
      <div class="stt-card">
        <div class="stt-label"><Icon name="eye" class="stt-ic c-green" />win rate as guesser</div>
        <div class="stt-big">{{ pct(s.guesser.rate) }}</div>
        <div class="stt-note">{{ s.guesser.won }} of {{ s.guesser.total }} rounds won</div>
        <div class="stt-bar"><div class="stt-bar-fill" :style="{ width: (s.guesser.rate ?? 0) + '%' }" /></div>
      </div>
    </div>

    <div class="stt-recent">
      <div class="stt-recent-title">recent games</div>
      <div v-if="s.recent.length === 0" class="stt-empty">no finished games yet. go play one!</div>
      <div v-for="g in s.recent" :key="g.k" class="stt-row">
        <span class="stt-result" :class="g.result">{{ label[g.result] }}</span>
        <span class="stt-score">{{ g.mine }} – {{ g.theirs }}</span>
        <span class="stt-date">{{ when(g.t) }}</span>
      </div>
    </div>

    <div class="stt-foot">
      <p>a round counts as a win when your team guessed the word first. the final drawdown is not counted in the drawer / guesser rates.</p>
      <button v-if="stats.games.length" class="stt-reset" @click="reset"><Icon name="trash" />{{ confirming ? 'click again to erase' : 'reset my stats' }}</button>
    </div>
  </div>
</template>
