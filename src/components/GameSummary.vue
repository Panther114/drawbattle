<script setup>
import { computed, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import confetti from 'canvas-confetti';
import { Sound, finalRoundScores, totalScores, rules, roundScores, teamPerformance } from '../shared.js';
import { API } from '../wordpacks.js';
import { track } from '../analytics.js';
import { nav } from '../nav.js';
import Btn from './Btn.vue';
import Icon from './Icon.vue';
import { buildFacts, computeMatch, formatDelta } from '../rating.js';
import Footer from './Footer.vue';
import TeamBoard from './TeamBoard.vue';
import { displayName } from '../shared.js';

const props = defineProps({
  game: { type: Object, required: true },
  showBackToLobby: { type: Boolean, required: true },
  userId: { type: String, required: true },
  fetchFullGame: { type: Function, required: true },
});
const emit = defineEmits(['audio-cue']);

const router = useRouter();
const Stage = { Score: 0, Winner: 1, Recap: 2 };

const shownScores = ref([]);
const stage = ref(Stage.Score);
const wordIndex = ref(0);
const showGuesses = ref(false);
const finalRound = computed(() => props.game.finalRound);
// the game may have been played without the final drawdown: then the recap walks through the rounds themselves
const hasFinal = computed(() => props.game.finalRound !== undefined);
const recapWords = computed(() => (hasFinal.value ? finalRound.value.words : props.game.previousRounds.map((r) => r.word)));
let trackedGuesses = false;
const timers = [];
const later = (fn, ms) => timers.push(setTimeout(fn, ms));

function toggleGuesses(e) {
  showGuesses.value = e.target.checked;
  if (!trackedGuesses) {
    track('click show guesses', { 'game id': props.game.id, 'user id': props.userId });
    trackedGuesses = true;
  }
}

// the final round replays earlier words: pair each team's original attempt with its final-round attempt
function recapFor(index) {
  if (!hasFinal.value) {
    return props.game.previousRounds[index].teamStates.map((original) => [index, original, undefined]);
  }
  const word = finalRound.value.words[index];
  const roundIdx = props.game.previousRounds.findIndex((r) => r.word === word);
  if (roundIdx === -1) throw new Error('Matching round not found for final round word');
  return props.game.previousRounds[roundIdx].teamStates.map((original, teamIdx) => {
    const states = finalRound.value.teamStates[teamIdx];
    return [roundIdx, original, index < states.length ? states[index] : undefined];
  });
}

async function backToLobby() {
  const res = await fetch(`${API}/games/${props.game.id}/backToLobby`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 200) {
    const params = { gameId: (await res.json()).nextGameId.toUpperCase() };
    if (props.userId in props.game.users) nav.previousGameUserName = props.game.users[props.userId].name;
    router.push({ name: 'Game', params });
  }
}

function fireConfetti(angle) {
  emit('audio-cue', Sound.Confetti);
  const base = Math.min(Math.max(0.2 * window.innerWidth, 100), 200);
  const common = {
    origin: { y: 0.7 },
    angle: angle ?? Math.random() * 30 + 75,
    gravity: 0.5,
    disableForReducedMotion: true,
  };
  const shoot = (ratio, opts) => confetti({ ...common, ...opts, particleCount: Math.floor(base * ratio) });
  shoot(0.25, { spread: 26, startVelocity: 55 });
  shoot(0.2, { spread: 60 });
  shoot(0.35, { spread: 100, decay: 0.91 });
  shoot(0.1, { spread: 120, startVelocity: 25, decay: 0.92 });
  shoot(0.1, { spread: 120, startVelocity: 45 });
}

// ---- reveal timeline ----
{
  const roundsTotal = props.game.previousRounds
    .map((r) => roundScores(r))
    .reduce((a, b) => a.map((x, i) => x + b[i]), props.game.teams.map(() => 0));
  const before = hasFinal.value ? roundsTotal : roundsTotal.map(() => 0);
  const gained = hasFinal.value ? finalRoundScores(finalRound.value) : roundsTotal;
  shownScores.value = before;
  for (let step = 1; step <= 20; step++) {
    later(() => {
      shownScores.value = before.map((b, i) => b + Math.floor((gained[i] * step) / 20));
    }, 500 + 50 * step);
  }
  later(() => emit('audio-cue', Sound.ScoreTally), 500);
  later(() => {
    stage.value = Stage.Winner;
    fireConfetti(90);
    later(() => emit('audio-cue', Sound.Fanfare), 500);
  }, 2000);
  later(() => {
    stage.value = Stage.Recap;
  }, 4000);
}
onUnmounted(() => timers.forEach(clearTimeout));

if (props.game.previousRounds[0]?.teamStates[0]?.canvasOperations === undefined) props.fetchFullGame();

const winningTeam = computed(() => {
  const scores = totalScores(props.game.previousRounds, finalRound.value);
  let best;
  let max = -1;
  scores.forEach((s, i) => {
    if (s > max) {
      best = i;
      max = s;
    } else if (s === max) best = undefined;
  });
  return best === undefined ? undefined : props.game.teams[best];
});
// one performance mark per team for the whole game (the final drawdown is not part of it)
const marks = computed(() => props.game.teams.map((_, i) => teamPerformance(props.game.previousRounds, i, props.game.settings.roundLengthSec)));
const startTimeFor = (original, teamIdx, roundIdx) => {
  const r = props.game.previousRounds[roundIdx];
  return (
    r.wordChosenTime +
    1000 * rules.drawingCountdownSec +
    (r.chooserId === r.teamStates[teamIdx].drawerId ? 1000 * r.chooserHeadStartSeconds : 0)
  );
};
void displayName;

// everyone's score change for this match, worked out the same way on every device
const scoreRows = computed(() => {
  try {
    if (props.game.previousRounds.length === 0) return [];
    const table = computeMatch(buildFacts(props.game, 'summary'));
    return Object.entries(table)
      .map(([id, r]) => ({ id, name: displayName(props.game.users[id] ?? {}), team: props.game.teams.findIndex((t) => t.userIds.includes(id)), ...r }))
      .sort((a, b) => b.delta - a.delta || (a.id < b.id ? -1 : 1));
  } catch {
    return [];
  }
});
const why = (r) => {
  const parts = [];
  if (r.guess) parts.push(`guesses ${Math.round(r.guess)}`);
  if (r.draw) parts.push(`drawing ${Math.round(r.draw)}`);
  if (r.result) parts.push(`result ${r.result}`);
  return parts.length ? parts.join(' · ') : 'no points earned';
};
</script>

<template>
  <div class="sm-root">
    <div class="sm-page-header">final scores</div>
    <div v-if="game.endedEarly" class="sm-early">
      {{ game.endedEarly === 'vote' ? 'the game was ended early by vote' : 'the game ended because everyone left' }}
    </div>
    <div class="sm-header-line" />
    <div class="sm-team-columns">
      <div v-for="(team, i) in game.teams" :key="i" class="sm-team-column">
        <div class="sm-team-score">{{ shownScores[i] }}</div>
        <Transition enter-from-class="sm-fade-enter-from" enter-active-class="sm-fade-enter-active">
          <div
            v-if="stage >= Stage.Winner && marks[i]"
            class="sc-perf"
            :title="`team performance: got ${Math.round(marks[i].rate * 100)}% of the words, scored on speed and word rate (not on winning)`"
          >
            <span class="sc-perf-label">team performance</span>
            <span class="pf-mark" :class="'pf-' + marks[i].mark">{{ marks[i].mark }}</span>
          </div>
        </Transition>
      </div>
    </div>

    <Transition enter-from-class="sm-fade-enter-from" enter-active-class="sm-fade-enter-active">
      <div v-if="stage >= Stage.Winner" class="sm-winner">
        <div class="sm-trophy" @click="fireConfetti(undefined)" />
        <div class="sm-winner-text">{{ winningTeam ? `${winningTeam.name} wins!` : "it's a draw!" }}</div>
        <div v-if="winningTeam">
          <div v-for="id in winningTeam.userIds" :key="id" class="sm-winning-user">
            {{ displayName(game.users[id]) }}
          </div>
        </div>
      </div>
    </Transition>

    <Transition enter-from-class="sm-fade-enter-from" enter-active-class="sm-fade-enter-active">
      <div v-if="stage >= Stage.Winner && scoreRows.length" class="sm-scores">
        <div class="sm-scores-title"><Icon name="trophy" class="sm-scores-ic" />score changes</div>
        <div class="sm-scores-note">every match shares out +100 points between the players, so a gain for one is a loss for another</div>
        <div v-for="(r, idx) in scoreRows" :key="r.id" class="sm-score-row" :class="{ me: r.id === userId }" :style="{ '--i': idx }">
          <span class="sm-score-dot" :class="'t' + r.team" />
          <span class="sm-score-name">{{ r.name }}<em v-if="r.id === userId"> (you)</em></span>
          <span class="sm-score-why">{{ why(r) }}</span>
          <span class="sm-score-old">{{ r.r0 }} → {{ r.r0 + r.delta }}</span>
          <span class="sm-score-delta" :class="r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : ''">{{ formatDelta(r.delta) }}</span>
        </div>
      </div>
    </Transition>

    <Transition enter-from-class="sm-fade-enter-from" enter-active-class="sm-fade-enter-active">
      <div v-if="stage >= Stage.Recap" class="sm-recap">
        <Btn v-if="showBackToLobby" class="sm-back-button" icon="back" @click="backToLobby">back to lobby</Btn>
        <div v-if="recapWords.length === 0" class="sm-no-rounds">no round was played</div>
        <div v-if="recapWords.length > 0" class="sm-recap-header">
          <div class="sm-recap-label">game recap</div>
          <div class="sm-word-select-row">
            <button type="button" class="sm-word-arrow prev" aria-label="previous word" :disabled="wordIndex <= 0" @click="wordIndex = Math.max(wordIndex - 1, 0)" />
            <div class="sm-word-select-wrapper">
              <div class="sm-word-select-text">{{ recapWords[wordIndex] }}</div>
              <select v-model.number="wordIndex" class="sm-word-select" aria-label="word">
                <option v-for="(w, i) in recapWords" :key="i" :value="i">{{ w }}</option>
              </select>
            </div>
            <button
              type="button"
              class="sm-word-arrow next"
              aria-label="next word"
              :disabled="wordIndex >= recapWords.length - 1"
              @click="wordIndex = Math.min(wordIndex + 1, recapWords.length - 1)"
            />
          </div>
          <div class="sm-show-guesses-row">
            <label class="sm-show-guesses-label" for="showGuesses">show guesses</label>
            <input id="showGuesses" type="checkbox" :checked="showGuesses" @change="toggleGuesses" />
          </div>
        </div>
        <div v-if="recapWords.length > 0" :key="wordIndex" class="sm-team-boards">
          <div v-for="([roundIdx, original, redo], teamIdx) in recapFor(wordIndex)" :key="teamIdx" class="sm-team-board-column">
            <TeamBoard
              class="sm-team-board"
              :users="game.users"
              :team="game.teams[teamIdx]"
              :team-state="original"
              :word="recapWords[wordIndex]"
              :drawing-stage-start-time="startTimeFor(original, teamIdx, roundIdx)"
              :on-summary-screen="true"
              :show-message-log="showGuesses"
              :show-disconnected-status="false"
            />
            <TeamBoard
              v-if="redo !== undefined"
              class="sm-team-board"
              :users="game.users"
              :team="game.teams[teamIdx]"
              :team-state="redo"
              :word="recapWords[wordIndex]"
              :drawing-stage-start-time="redo.startTime"
              :on-summary-screen="true"
              :show-message-log="showGuesses"
              :show-disconnected-status="false"
            />
          </div>
        </div>
      </div>
    </Transition>
    <Footer v-if="stage >= Stage.Recap" />
  </div>
</template>
