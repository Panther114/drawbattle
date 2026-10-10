<script setup>
import { computed, ref } from 'vue';
import { resetStats, stats, summarize } from '../stats.js';
import { formatDelta, resetScore, score } from '../rating.js';
import Icon from '../components/Icon.vue';
import TopNav from '../components/TopNav.vue';

const s = computed(() => summarize(stats.games));
const last = computed(() => score.history[score.history.length - 1]);
// the rating after each of the last 20 matches as a small line
const spark = computed(() => {
  const pts = [0, ...score.history.slice(-20).map((h) => h.rating)];
  if (pts.length < 2) return '';
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const span = Math.max(1, hi - lo);
  return pts.map((v, i) => `${((i / (pts.length - 1)) * 100).toFixed(1)},${(36 - ((v - lo) / span) * 32).toFixed(1)}`).join(' ');
});
const confirming = ref(false);
const pct = (v) => (v === undefined ? '–' : `${v}%`);
const when = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const label = { win: 'won', loss: 'lost', draw: 'draw' };
// what the player score moved by in a game (the history is replayed from the stored matches)
const deltaOf = (g) => score.history.find((h) => h.k === g.k)?.delta;
const signClass = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'zero');

function reset() {
  if (!confirming.value) {
    confirming.value = true;
    setTimeout(() => (confirming.value = false), 4000);
    return;
  }
  resetStats();
  resetScore();
  confirming.value = false;
}
</script>

<template>
  <div class="stt-root">
    <TopNav><router-link to="/" class="nav-home"><Icon name="home" />back to home</router-link></TopNav>
    <div class="stt-title">my stats</div>
    <div class="stt-sub">kept only in this browser. nothing is sent to the server</div>

    <div class="stt-cards">
      <div class="stt-card score">
        <div class="stt-label"><Icon name="trophy" class="stt-ic c-purple" />player score</div>
        <div class="stt-big" :class="{ neg: score.rating < 0 }">{{ score.rating }}</div>
        <div class="stt-note">
          <template v-if="last">last game {{ formatDelta(last.delta) }} · {{ score.history.length }} counted</template>
          <template v-else>everyone starts at 0</template>
        </div>
        <svg v-if="spark" class="stt-spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><polyline :points="spark" vector-effect="non-scaling-stroke" /></svg>
      </div>
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
        <span v-if="deltaOf(g) !== undefined" class="stt-delta" :class="signClass(deltaOf(g))" title="player score change">{{ formatDelta(deltaOf(g)) }}</span>
        <span v-if="g.mark" class="pf-mark" :class="'pf-' + g.mark" title="team performance">{{ g.mark }}</span>
        <span class="stt-date">{{ when(g.t) }}</span>
        <div v-if="g.r.length" class="stt-rounds">
          <span
            v-for="r in g.r"
            :key="r[0]"
            class="stt-rd"
            :class="signClass(r[3] ?? 0)"
            :title="'round ' + (r[0] + 1) + ': ' + (r[1] === 'd' ? 'you drew' : 'you guessed') + (r[2] ? ', your team won it' : '')"
          >
            <span class="stt-rd-n">{{ r[0] + 1 }}</span>
            <template v-if="r[3] !== undefined">{{ formatDelta(r[3]) }}</template>
            <template v-else>{{ r[2] ? 'won' : 'lost' }}</template>
            <span v-if="r[4]" class="pf-mark pf-sm" :class="'pf-' + r[4]">{{ r[4] }}</span>
          </span>
        </div>
      </div>
    </div>

    <div class="stt-foot">
      <p>a round counts as a win when your team guessed the word first. under each game, every round shows the points your team gained or lost against the other team (and the team performance mark so far). the final drawdown is not counted in the drawer / guesser rates.</p>
      <p>team performance mark, S to F: how fast and how often your team got the word, whether or not it won the round. an S means nearly every word, quickly.</p>
      <p>player score: every match shares out +100 points. you earn points for fast first guesses and quick drawings, plus a bonus for winning, and you give up the average of the lobby.</p>
      <button v-if="stats.games.length || score.history.length" class="stt-reset" @click="reset"><Icon name="trash" />{{ confirming ? 'click again to erase' : 'reset my stats' }}</button>
    </div>
  </div>
</template>
