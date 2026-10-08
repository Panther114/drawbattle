<script setup>
import { computed, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import confetti from 'canvas-confetti';
import { Sound, finalRoundScores, totalScores, rules, roundScores } from '../shared.js';
import { API } from '../wordpacks.js';
import { track } from '../analytics.js';
import { nav } from '../nav.js';
import Btn from './Btn.vue';
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
    .reduce((a, b) => a.map((x, i) => x + b[i]));
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
const startTimeFor = (original, teamIdx, roundIdx) => {
  const r = props.game.previousRounds[roundIdx];
  return (
    r.wordChosenTime +
    1000 * rules.drawingCountdownSec +
    (r.chooserId === r.teamStates[teamIdx].drawerId ? 1000 * r.chooserHeadStartSeconds : 0)
  );
};
void displayName;
</script>

<template>
  <div class="sm-root">
    <div class="sm-page-header">final scores</div>
    <div class="sm-header-line" />
    <div class="sm-team-columns">
      <div v-for="(team, i) in game.teams" :key="i" class="sm-team-column">
        <div class="sm-team-score">{{ shownScores[i] }}</div>
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
      <div v-if="stage >= Stage.Recap" class="sm-recap">
        <Btn v-if="showBackToLobby" class="sm-back-button" icon="back" @click="backToLobby">back to lobby</Btn>
        <div class="sm-recap-header">
          <div class="sm-recap-label">game recap</div>
          <div class="sm-word-select-row">
            <button class="sm-word-arrow prev" :disabled="wordIndex <= 0" @click="wordIndex = Math.max(wordIndex - 1, 0)" />
            <div class="sm-word-select-wrapper">
              <div class="sm-word-select-text">{{ recapWords[wordIndex] }}</div>
              <select v-model.number="wordIndex" class="sm-word-select">
                <option v-for="(w, i) in recapWords" :key="i" :value="i">{{ w }}</option>
              </select>
            </div>
            <button
              class="sm-word-arrow next"
              :disabled="wordIndex >= recapWords.length - 1"
              @click="wordIndex = Math.min(wordIndex + 1, recapWords.length - 1)"
            />
          </div>
          <div class="sm-show-guesses-row">
            <label class="sm-show-guesses-label" for="showGuesses">show guesses</label>
            <input id="showGuesses" type="checkbox" :checked="showGuesses" @change="toggleGuesses" />
          </div>
        </div>
        <div :key="wordIndex" class="sm-team-boards">
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
