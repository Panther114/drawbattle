<script setup>
import { computed, onUnmounted, ref } from 'vue';
import {
  C,
  headStartForStreak,
  rules,
  Sound,
  UserStatus,
  canAutoStartNext,
  drawingStartTime,
  nextDrawer,
  roundScores,
  roundWinner,
  totalScores,
  winStreak,
} from '../shared.js';
import { track } from '../analytics.js';
import { useKeys } from '../keys.js';
import Btn from './Btn.vue';
import IconWithText from './IconWithText.vue';
import KeyHint from './KeyHint.vue';
import TeamBoard from './TeamBoard.vue';
import Username from './Username.vue';

const props = defineProps({
  gameId: { type: String, required: true },
  roundIndex: { type: Number, required: true },
  round: { type: Object, required: true },
  readyUserIds: { type: Object },
  previousRounds: { type: Array, required: true },
  users: { type: Object, required: true },
  teams: { type: Array, required: true },
  isSpectator: { type: Boolean, required: true },
  currentUserId: { type: String, required: true },
  gameSettings: { type: Object, required: true },
  canReady: { type: Boolean, default: true }, // false while the round's results are not the thing on screen yet
});
const emit = defineEmits(['client-message', 'audio-cue']);

// stages of the reveal animation
const Stage = { Score: 0, Drawer: 1, GetReadyFor: 2, TheFinalDrawdown: 3, Recap: 4 };

const shownScores = ref([]);
const stage = ref(Stage.Score);
const roundNumber = computed(() => props.previousRounds.length + 1);
const isLastRound = computed(() => roundNumber.value === props.gameSettings.numRounds);
// without the final drawdown the last round is the end of the game
const showFinal = computed(() => isLastRound.value && rules.finalDrawdown);
const lastNoFinal = computed(() => isLastRound.value && !rules.finalDrawdown);
const forceAvailable = ref(false);
const timers = [];
const later = (fn, ms) => timers.push(setTimeout(fn, ms));

// the same button also takes the ready back
function ready() {
  if (!props.canReady) return;
  emit('client-message', [C.ReadyUp, props.roundIndex]);
}
function forceStart() {
  emit('client-message', [C.ForceStartNextRound, props.roundIndex]);
  track('click start next round button', {
    'game id': props.gameId,
    'user id': props.currentUserId,
    'round index': props.roundIndex,
  });
}

// ---- reveal timeline ----
{
  const before = props.previousRounds.length > 0 ? totalScores(props.previousRounds, undefined) : props.teams.map(() => 0);
  shownScores.value = before;
  const gained = roundScores(props.round);
  let t = 0;
  if (gained.some((s) => s > 0)) {
    for (let step = 1; step <= 20; step++) {
      later(() => {
        shownScores.value = before.map((b, i) => b + Math.floor((gained[i] * step) / 20));
      }, 500 + 50 * step);
    }
    later(() => emit('audio-cue', Sound.ScoreTally), 500);
    t += 1500;
  }
  t += 500;
  later(() => {
    stage.value = Stage.Drawer;
  }, t);
  if (showFinal.value) {
    t += 1000;
    later(() => {
      stage.value = Stage.GetReadyFor;
    }, t);
    t += 500;
    later(() => {
      stage.value = Stage.TheFinalDrawdown;
    }, t);
    t += 2500;
    later(() => {
      stage.value = Stage.Recap;
    }, t);
  } else {
    t += 2000;
    later(() => {
      stage.value = Stage.Recap;
    }, t);
  }
}
later(() => {
  forceAvailable.value = true;
}, 11000);
onUnmounted(() => timers.forEach(clearTimeout));

// Enter while the scores are still counting up skips straight to the end of the reveal (the next Enter readies up)
function skipReveal() {
  timers.splice(0).forEach(clearTimeout);
  shownScores.value = totalScores([...props.previousRounds, props.round], undefined);
  stage.value = Stage.Recap;
  later(() => {
    forceAvailable.value = true;
  }, 6000);
}
useKeys([
  { key: 'enter', when: () => stage.value !== Stage.Recap && !props.isSpectator, run: skipReveal },
  { key: 'enter', when: () => stage.value === Stage.Recap && !props.isSpectator && props.canReady, run: ready },
  { key: 'f', when: () => stage.value === Stage.Recap && !props.isSpectator && showForce.value, run: forceStart },
]);

// ---- derived display data ----
const winner = computed(() => roundWinner(props.round));
const nextDrawers = computed(() => {
  const w = winner.value;
  return props.round.teamStates.map((ts, i) => {
    const drawer = ts.drawerId;
    return i === w && !rules.alwaysRotate && props.teams[i].userIds.includes(drawer) && props.users[drawer].status !== UserStatus.Disconnected
      ? drawer
      : nextDrawer(props.teams[i], props.users, drawer);
  });
});
const lineups = computed(() =>
  props.teams.map((team, i) => {
    const n = team.userIds.indexOf(nextDrawers.value[i]);
    return team.userIds.slice(isLastRound.value ? n : n + 1).concat(team.userIds.slice(0, n));
  }),
);
const streak = computed(() => winStreak([...props.previousRounds, props.round], nextDrawers.value));
const headStart = computed(() => headStartForStreak(streak.value));
const isReady = (id) => props.readyUserIds?.has(id);
const iAmReady = computed(() => props.readyUserIds?.has(props.currentUserId));
const showForce = computed(
  () =>
    props.readyUserIds !== undefined &&
    (forceAvailable.value || canAutoStartNext(Array.from(props.readyUserIds), props.teams, props.users)),
);

// what to render in each team column below the score
function drawerBlock(i) {
  const showDrawer = stage.value >= Stage.Drawer;
  if (lastNoFinal.value) {
    const drawer = props.round.teamStates[i].drawerId;
    return winner.value === i ? { kind: 'winner', id: drawer } : { kind: 'old', id: drawer };
  }
  if (winner.value === i) {
    const drawer = props.round.teamStates[winner.value].drawerId;
    if (!showDrawer || (!isLastRound.value && nextDrawers.value[i] === drawer)) {
      return { kind: 'winner', id: drawer };
    }
    return isLastRound.value ? undefined : { kind: 'next', label: 'next drawer', id: nextDrawers.value[i] };
  }
  if (showDrawer) {
    if (isLastRound.value) return undefined;
    return {
      kind: 'challenger',
      label: winner.value === undefined ? 'next drawer' : 'next challenger',
      id: nextDrawers.value[i],
    };
  }
  return { kind: 'old', id: props.round.teamStates[i].drawerId };
}
void drawingStartTime;
</script>

<template>
  <div class="sc-root">
    <div class="sc-round-header">round {{ roundNumber }}</div>
    <div class="sc-round-line" />
    <div class="sc-team-columns">
      <div v-for="(team, i) in teams" :key="i" class="sc-team-column">
        <div class="sc-team-score">{{ shownScores[i] }}</div>
        <Transition mode="out-in" name="sc-fade">
          <div v-if="drawerBlock(i)?.kind === 'winner'" key="winningDrawer" class="sc-drawer">
            <div class="sc-small-header">winner</div>
            <div class="sc-drawer-name" :class="{ 'sc-readied': isReady(drawerBlock(i).id) }">
              <Username :user="users[drawerBlock(i).id]" />
            </div>
            <IconWithText v-if="streak >= 2" icon="trophy" color="yellow">{{ streak }}x streak</IconWithText>
          </div>
          <div
            v-else-if="drawerBlock(i)?.kind === 'next' || drawerBlock(i)?.kind === 'challenger'"
            key="newDrawer"
            class="sc-drawer"
          >
            <div class="sc-small-header">{{ drawerBlock(i).label }}</div>
            <div class="sc-drawer-name" :class="{ 'sc-readied': isReady(drawerBlock(i).id) }">
              <Username :user="users[drawerBlock(i).id]" />
            </div>
            <IconWithText v-if="drawerBlock(i).kind === 'challenger' && headStart > 0" icon="headstartClock" color="yellow">
              {{ headStart }}s head start
            </IconWithText>
          </div>
          <div v-else-if="drawerBlock(i)?.kind === 'old'" key="oldDrawer" class="sc-drawer">
            <div class="sc-small-header">last drawer</div>
            <div class="sc-drawer-name sc-losing-drawer"><Username :user="users[drawerBlock(i).id]" /></div>
          </div>
          <div v-else />
        </Transition>
      </div>
    </div>

    <Transition enter-from-class="sc-fade-enter-from" enter-active-class="sc-fade-enter-active">
      <div v-if="showFinal && stage >= Stage.GetReadyFor">it's time for...</div>
    </Transition>
    <Transition enter-from-class="sc-final-enter-from" enter-active-class="sc-final-enter-active">
      <div v-if="showFinal && stage >= Stage.TheFinalDrawdown" class="sc-final-title">the final drawdown!</div>
    </Transition>

    <Transition enter-from-class="sc-fade-enter-from" enter-active-class="sc-fade-enter-active">
      <div v-if="stage === Stage.Recap" class="sc-recap">
        <div v-if="!lastNoFinal" class="sc-team-columns">
          <div v-for="(team, i) in teams" :key="i" class="sc-team-column">
            <div class="sc-small-header">{{ isLastRound ? 'lineup' : 'on deck' }}</div>
            <div v-for="id in lineups[i]" :key="id" class="sc-on-deck" :class="{ 'sc-readied': isReady(id) }">
              <Username :user="users[id]" />
            </div>
          </div>
        </div>
        <template v-if="!isSpectator">
          <Btn :disabled="!canReady" :icon="iAmReady ? 'check' : 'next'" :title="iAmReady ? 'click to cancel' : undefined" hint="enter" @click="ready">{{ iAmReady ? 'waiting... (click to cancel)' : lastNoFinal ? 'see results' : 'continue' }}</Btn>
          <button v-if="showForce" class="sc-force-start" @click="forceStart">
            {{ lastNoFinal ? 'show the final results' : `start ${isLastRound ? 'final drawdown' : 'next round'}` }}<KeyHint k="f" />
          </button>
          <div class="sc-continue-spacer" />
        </template>
        <div class="sc-team-boards">
          <TeamBoard
            v-for="(team, i) in teams"
            :key="i"
            class="sc-team-board"
            :word="round.word"
            :drawing-stage-start-time="drawingStartTime(round, i)"
            :users="users"
            :team="team"
            :team-state="round.teamStates[i]"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>
