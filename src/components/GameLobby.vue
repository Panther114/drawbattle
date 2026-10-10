<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { C, MAX_NAME_LENGTH, cleanNameInput, containsYouTag, rules, sanitizeName, Sound } from '../shared.js';
import { packs } from '../wordpacks.js';
import { track } from '../analytics.js';
import { safeStorage } from '../storage.js';
import { useKeys } from '../keys.js';
import Btn from './Btn.vue';
import Icon from './Icon.vue';
import KeyHint from './KeyHint.vue';
import FishbowlPopulation from './FishbowlPopulation.vue';
import Footer from './Footer.vue';
import Settings from './Settings.vue';
import Username from './Username.vue';

const props = defineProps({
  isConnected: { type: Boolean, required: true },
  gameId: { type: String, required: true },
  userId: { type: String, required: true },
  isSpectator: { type: Boolean, required: true },
  users: { type: Object, required: true },
  teams: { type: Array, required: true },
  gameSettings: { type: Object, required: true },
  fishbowlWords: { type: Object },
  connectedApp: { type: String },
  startGameSecondsRemaining: { type: Number },
  initUserName: { type: String },
});
const emit = defineEmits(['client-message', 'audio-cue', 'join-game', 'spectate-game']);

const storage = safeStorage('local');
if (props.initUserName != null) storage?.setItem('userName', props.initUserName);
const name = ref(sanitizeName(props.initUserName ?? storage?.getItem('userName') ?? ''));
// a username can never contain "(you)" (the lobby adds its own tag to your own entry)
watch(name, (v) => {
  if (containsYouTag(v)) name.value = cleanNameInput(v);
});
const cleanName = computed(() => sanitizeName(name.value));
const nameInput = ref();
const startCooldown = ref(false);

onMounted(() => nameInput.value?.focus());
// joined: let go of the name box so the keys work again
watch(
  () => props.isConnected,
  (c) => c && nameInput.value?.blur(),
);

watch(
  () => props.startGameSecondsRemaining,
  (now, before) => {
    if (now !== undefined) emit('audio-cue', Sound.BeepLow);
    if (now === undefined && before !== undefined) {
      // briefly lock the start button after a cancelled countdown
      startCooldown.value = true;
      setTimeout(() => {
        startCooldown.value = false;
      }, 3000);
    }
  },
);

const pack = computed(() => packs[props.gameSettings.wordListId]);

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = window.setTimeout(() => fn(...a), ms);
  };
}
const pushName = debounce(() => {
  const n = cleanName.value;
  storage?.setItem('userName', n);
  if (props.isConnected) emit('client-message', [C.UpdateUserName, n]);
}, 500);

let lastStart = 0;
function startGame() {
  const now = Date.now();
  if (now < lastStart + 200) return;
  lastStart = now;
  track('click start game button', { 'game id': props.gameId });
  emit('client-message', [C.StartGame]);
}
function cancelStart() {
  track('click cancel start game button', { 'game id': props.gameId });
  emit('client-message', [C.CancelStartGame]);
}
let lastJoin;
function joinTeam(i) {
  const now = Date.now();
  if (lastJoin !== undefined && lastJoin[0] === i && now < lastJoin[1] + 500) return;
  emit('client-message', [C.JoinTeam, i]);
  lastJoin = [i, now];
}
const isFull = (t) => t.userIds.length >= rules.maxTeamSize;
const randomTeams = computed(() => props.gameSettings.randomTeams === true);
// random teams: one list for everyone (the manual teams stay untouched underneath), drawn into two at the start
const everyone = computed(() => props.teams.flatMap((t) => t.userIds));
const needsPlayers = computed(() =>
  randomTeams.value ? everyone.value.length < 4 : props.teams.some((t) => t.userIds.length < 2),
);
const starting = computed(() => props.startGameSecondsRemaining !== undefined);
const canJoinTeam = (ti) => {
  const team = props.teams[ti];
  return (
    props.isConnected && !props.isSpectator && props.fishbowlWords === undefined && !randomTeams.value && !starting.value &&
    team !== undefined && !team.userIds.includes(props.userId) && !isFull(team)
  );
};
const startDisabled = computed(
  () =>
    props.isSpectator ||
    needsPlayers.value ||
    starting.value ||
    startCooldown.value ||
    (pack.value !== undefined && pack.value.numWords < 2 * props.gameSettings.numRounds),
);

// ---- keyboard: Enter joins, then starts the game; 1 / 2 pick a team ----
function onEnter() {
  if (props.isSpectator) return false;
  if (!props.isConnected) {
    if (!cleanName.value) return false;
    emit('join-game', cleanName.value);
    return;
  }
  if (props.fishbowlWords !== undefined || startDisabled.value) return false;
  startGame();
}
useKeys([
  { key: 'enter', run: onEnter },
  { key: 'esc', when: () => starting.value && !props.isSpectator, run: cancelStart },
  { key: 'n', when: () => nameInput.value !== undefined && !nameInput.value.disabled, run: () => nameInput.value.focus() },
  { key: 's', when: () => !props.isConnected && !props.isSpectator, run: () => emit('spectate-game') },
  ...[0, 1, 2, 3].map((ti) => ({ key: String(ti + 1), when: () => canJoinTeam(ti), run: () => joinTeam(ti) })),
]);
</script>

<template>
  <div class="lobby-root" :class="{ joined: isConnected }">
    <div v-if="connectedApp !== undefined" class="lobby-welcome">
      <div class="lobby-welcome-header">welcome to drawbattle.io!</div>
      <div class="lobby-welcome-tagline">two teams of drawers face off with a frantic final round</div>
    </div>

    <form v-if="!isSpectator" class="lobby-name-form" @submit.prevent="cleanName && emit('join-game', cleanName)">
      <label class="lobby-name-label" for="nameInput">my name is</label>
      <KeyHint v-if="isConnected" k="n" />
      <input
        id="nameInput"
        ref="nameInput"
        v-model="name"
        type="text"
        class="lobby-name-input"
        :maxlength="MAX_NAME_LENGTH"
        autocorrect="off"
        spellcheck="false"
        :disabled="fishbowlWords !== undefined || starting"
        @input="pushName"
      />
      <template v-if="!isConnected">
        <div>
          <Btn :force-rotation="-2" icon="enter" class="lobby-join-button" :disabled="cleanName.length === 0" hint="enter">join game</Btn>
        </div>
        <div class="lobby-spectate-row">
          <a href="#" class="spectate-link" @click.prevent="emit('spectate-game')">join as spectator</a>
          <KeyHint k="s" />
        </div>
      </template>
    </form>

    <template v-if="isConnected">
      <Transition name="lobby-swap" mode="out-in">
      <div v-if="randomTeams" key="random" class="lobby-teams random">
        <div class="lobby-team">
          <div class="lobby-team-name"><Icon name="shuffle" class="lobby-random-ic" />random teams</div>
          <div class="lobby-team-line" />
          <TransitionGroup name="lu" tag="div" class="lobby-users">
            <div v-for="uid in everyone" :key="uid" class="lobby-user" :class="{ submitted: fishbowlWords !== undefined && fishbowlWords[uid] !== undefined }">
              <span v-if="uid === userId">{{ cleanName || 'anonymous' }} (you)<sup v-if="users[uid]?.rating !== undefined" class="rating">{{ users[uid].rating }}</sup></span>
              <Username v-else :user="users[uid]" />
            </div>
          </TransitionGroup>
          <div class="lobby-random-note">two teams are drawn when the game starts</div>
        </div>
      </div>
      <div v-else key="manual" class="lobby-teams">
        <div v-for="(team, ti) in teams" :key="team.name" class="lobby-team">
          <div class="lobby-team-name">{{ team.name }}</div>
          <div class="lobby-team-line" />
          <TransitionGroup name="lu" tag="div" class="lobby-users">
            <div
              v-for="uid in team.userIds"
              :key="uid"
              class="lobby-user"
              :class="{ submitted: fishbowlWords !== undefined && fishbowlWords[uid] !== undefined }"
            >
              <span v-if="uid === userId">{{ cleanName || 'anonymous' }} (you)<sup v-if="users[uid]?.rating !== undefined" class="rating">{{ users[uid].rating }}</sup></span>
              <Username v-else :user="users[uid]" />
            </div>
          </TransitionGroup>
          <Btn
            v-if="!(isSpectator || fishbowlWords !== undefined)"
            class="lobby-join-team"
            color="purple"
            :disabled="starting || team.userIds.includes(userId) || isFull(team)"
            :hint="canJoinTeam(ti) ? String(ti + 1) : ''"
            :force-rotation="ti % 2 === 0 ? -2.5 : 3"
            @click="joinTeam(ti)"
          >
            {{ isFull(team) ? 'team full' : `join ${team.name}` }}
          </Btn>
        </div>
      </div>
      </Transition>

      <FishbowlPopulation
        v-if="fishbowlWords !== undefined"
        :num-users="Object.keys(users).length"
        :num-rounds="gameSettings.numRounds"
        :fishbowl-words="fishbowlWords"
        :user-id="userId"
        :start-game-seconds-remaining="startGameSecondsRemaining"
        @client-message="(m) => emit('client-message', m)"
      />
      <template v-else>
        <div class="lobby-start-container">
          <Btn :force-rotation="0" icon="play" :disabled="startDisabled" :hint="startDisabled ? '' : 'enter'" @click="startGame">
            {{ starting ? `starting in ${startGameSecondsRemaining}...` : 'start game!' }}
          </Btn>
          <div class="lobby-start-subtext">
            <template v-if="needsPlayers">{{ randomTeams ? 'random teams need at least 4 players' : 'each team needs at least 2 players' }}</template>
            <button v-if="!isSpectator && starting" type="button" class="lobby-cancel" @click="cancelStart">cancel<KeyHint k="esc" /></button>
          </div>
        </div>
        <Settings
          :game-id="gameId"
          :game-settings="gameSettings"
          :disabled="isSpectator || starting"
          @client-message="(m) => emit('client-message', m)"
        />
      </template>
      <Footer />
    </template>
  </div>
</template>
