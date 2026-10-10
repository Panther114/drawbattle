<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { C } from '../shared.js';
import { DEFAULT_WORD_LIST_ID, isStandardPack, loadPack, packs } from '../wordpacks.js';
import { track } from '../analytics.js';
import { useKeys } from '../keys.js';
import KeyHint from './KeyHint.vue';
import WordListSelectorItem from './WordListSelectorItem.vue';
import WordListSelectorModal from './WordListSelectorModal.vue';
import RulesModal from './RulesModal.vue';
import { DEFAULT_RULES, LOBBY_RULES } from '../shared.js';

const props = defineProps({
  gameId: { type: String, required: true },
  gameSettings: { type: Object, required: true },
  disabled: { type: Boolean, required: true },
});
const emit = defineEmits(['client-message']);

const MAX_ROUNDS = 200;
const MAX_ROUND_LENGTH = 600;

const numRounds = ref(props.gameSettings.numRounds);
const roundLengthSec = ref(props.gameSettings.roundLengthSec);
const initialPack = props.gameSettings.wordListId;
const wordListId = ref(initialPack);
const showWordLength = ref(!props.gameSettings.hideWordLength);
const streamerMode = ref(props.gameSettings.streamerMode);
const finalDrawdown = ref(props.gameSettings.finalDrawdown !== false);
const randomTeams = ref(props.gameSettings.randomTeams === true);
const copied = ref(false);
const roundsInput = ref();
const lengthInput = ref();
const modalOpen = ref(false);
const rulesOpen = ref(false);
const headStart = ref(props.gameSettings.headStart !== false);
const alwaysRotate = ref(props.gameSettings.alwaysRotate === true);
const allowLateJoin = ref(props.gameSettings.allowLateJoin !== false);
const changedRules = computed(
  () =>
    Object.keys(DEFAULT_RULES).filter(
      (k) => !LOBBY_RULES.includes(k) && props.gameSettings[k] !== undefined && props.gameSettings[k] !== DEFAULT_RULES[k],
    ).length + (streamerMode.value ? 1 : 0),
);
// a non-standard pack that was picked stays pinned at the top of the pack list
const customPack = ref(isStandardPack(initialPack) ? undefined : initialPack);

const inviteLink = computed(() => `${window.location.host}/${props.gameId.toUpperCase()}`);
const pack = computed(() => packs[wordListId.value]);
// every round uses 2 words, so the pack size caps the round count
const maxRounds = computed(() => Math.min(MAX_ROUNDS, pack.value === undefined ? MAX_ROUNDS : Math.floor(pack.value.numWords / 2)));

function clampInt(raw, lo, hi, fallback) {
  const n = Math.round(Number(raw));
  return String(raw).trim() === '' || !Number.isFinite(n) ? fallback : Math.min(hi, Math.max(lo, n));
}

const send = (settings) => emit('client-message', [C.UpdateSettings, settings]);
// the server's settings overlaid with the local copies, so quick successive edits don't overwrite each other
const current = () => ({
  ...props.gameSettings,
  numRounds: numRounds.value,
  roundLengthSec: roundLengthSec.value,
  wordListId: wordListId.value,
  hideWordLength: !showWordLength.value,
  streamerMode: streamerMode.value,
  finalDrawdown: finalDrawdown.value,
  randomTeams: randomTeams.value,
  headStart: headStart.value,
  alwaysRotate: alwaysRotate.value,
  allowLateJoin: allowLateJoin.value,
});

function changeRounds(e) {
  const v = clampInt(e.target.value, 1, maxRounds.value, numRounds.value);
  e.target.value = v;
  track('change game setting', { 'game id': props.gameId, key: 'numRounds', value: v });
  numRounds.value = v;
  send({ ...current(), numRounds: v });
}
function changeLength(e) {
  const v = clampInt(e.target.value, 5, MAX_ROUND_LENGTH, roundLengthSec.value);
  e.target.value = v;
  track('change game setting', { 'game id': props.gameId, key: 'roundLengthSec', value: v });
  roundLengthSec.value = v;
  send({ ...current(), roundLengthSec: v });
}
function selectPack(id) {
  if (id === wordListId.value) return;
  track('change game setting', { 'game id': props.gameId, key: 'wordListId', value: id });
  wordListId.value = id;
  send({ ...current(), wordListId: id });
}
function changeShowLength(e) {
  const v = e.target.checked;
  track('change game setting', { 'game id': props.gameId, key: 'hideWordLength', value: !v });
  showWordLength.value = v;
  send({ ...current(), hideWordLength: !v });
}
function changeFinal(e) {
  const v = e.target.checked;
  track('change game setting', { 'game id': props.gameId, key: 'finalDrawdown', value: v });
  finalDrawdown.value = v;
  send({ ...current(), finalDrawdown: v });
}
function changeRandom(e) {
  const v = e.target.checked;
  track('change game setting', { 'game id': props.gameId, key: 'randomTeams', value: v });
  randomTeams.value = v;
  send({ ...current(), randomTeams: v });
}
function changeHeadStart(e) {
  const v = e.target.checked;
  track('change game setting', { 'game id': props.gameId, key: 'headStart', value: v });
  headStart.value = v;
  send({ ...current(), headStart: v });
}
function changeRotate(e) {
  const v = e.target.checked;
  track('change game setting', { 'game id': props.gameId, key: 'alwaysRotate', value: v });
  alwaysRotate.value = v;
  send({ ...current(), alwaysRotate: v });
}
function changeLateJoin(e) {
  const v = e.target.checked;
  track('change game setting', { 'game id': props.gameId, key: 'allowLateJoin', value: v });
  allowLateJoin.value = v;
  send({ ...current(), allowLateJoin: v });
}

async function copyLink() {
  const text = `${window.location.protocol}//${inviteLink.value}`;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {
      // ignore
    }
    ta.remove();
  }
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1500);
}

onMounted(() => {
  void loadPack(wordListId.value);
  if (!isStandardPack(wordListId.value)) customPack.value = wordListId.value;
});
// keep local state in sync with settings pushed by the server
watch(
  () => props.gameSettings,
  (s) => {
    numRounds.value = s.numRounds;
    roundLengthSec.value = s.roundLengthSec;
    wordListId.value = s.wordListId;
    showWordLength.value = !s.hideWordLength;
    streamerMode.value = s.streamerMode;
    finalDrawdown.value = s.finalDrawdown !== false;
    randomTeams.value = s.randomTeams === true;
    headStart.value = s.headStart !== false;
    alwaysRotate.value = s.alwaysRotate === true;
    allowLateJoin.value = s.allowLateJoin !== false;
  },
);
// keep the round count legal whenever the pack changes
watch(
  [maxRounds, numRounds],
  () => {
    if (maxRounds.value >= 1 && numRounds.value > maxRounds.value && !props.disabled) {
      numRounds.value = maxRounds.value;
      send({ ...current(), numRounds: maxRounds.value });
    }
  },
  { immediate: true },
);
watch(wordListId, (id) => {
  void loadPack(id);
  if (!isStandardPack(id)) customPack.value = id;
});

// ---- keyboard: the lobby toggles sit on 3-8 (1 and 2 join a team), in the order they are listed ----
const flip = (state, change) => () => change({ target: { checked: !state.value } });
const editable = () => !props.disabled;
useKeys([
  { key: '3', when: editable, run: flip(showWordLength, changeShowLength) },
  { key: '4', when: editable, run: flip(finalDrawdown, changeFinal) },
  { key: '5', when: editable, run: flip(randomTeams, changeRandom) },
  { key: '6', when: editable, run: flip(headStart, changeHeadStart) },
  { key: '7', when: editable, run: flip(alwaysRotate, changeRotate) },
  { key: '8', when: editable, run: flip(allowLateJoin, changeLateJoin) },
]);

const listIds = computed(() => {
  const ids = [DEFAULT_WORD_LIST_ID];
  if (customPack.value !== undefined) ids.unshift(customPack.value);
  return ids;
});
</script>

<template>
  <div class="st-table" :class="{ 'kh-off': disabled }">
    <div class="st-invite-row">
      <div class="st-row-label">invite</div>
      <div class="st-row-body">
        <div class="st-invite-link">
          <input
            type="text"
            :value="streamerMode ? `${inviteLink.slice(0, -4)}****` : inviteLink"
            readonly
            class="st-invite-input"
            @focus="(e) => e.target.select()"
          />
          <button class="st-copy-button" @click="copyLink">{{ copied ? 'copied!' : 'copy' }}</button>
        </div>
      </div>
    </div>
    <div class="st-wordpack-row">
      <div class="st-row-label st-wordpack-label">word pack</div>
      <div class="st-row-body st-wordpack-body">
        <template v-for="id in listIds" :key="id">
          <WordListSelectorItem
            v-if="packs[id] !== undefined"
            :word-list-id="id"
            :selected="wordListId === id"
            :disabled="disabled"
            :rotate="true"
            @select-list="selectPack(id)"
          />
        </template>
        <button
          class="wp-item"
          :disabled="disabled"
          @click="
            modalOpen = true;
            track('open word pack modal', { 'game id': gameId });
          "
        >
          <div>browse all packs</div>
          <div class="wp-description">or select a custom word pack!</div>
        </button>
      </div>
    </div>
    <div class="st-settings-row">
      <div class="st-row-label">settings</div>
      <div class="st-row-body">
        <div>
          <div v-if="maxRounds >= 1" class="st-item">
            <input
              ref="roundsInput"
              class="st-number"
              type="number"
              inputmode="numeric"
              step="1"
              min="1"
              :max="maxRounds"
              :value="numRounds"
              :disabled="disabled"
              @change="changeRounds"
              @keydown.enter.prevent="$event.target.blur()"
            />
            <div>{{ gameSettings.finalDrawdown === false ? 'rounds' : 'rounds + the final drawdown' }}</div>
          </div>
          <div v-else class="st-item st-not-enough-words">word pack needs more words!</div>
          <div class="st-item">
            <input
              ref="lengthInput"
              class="st-number"
              type="number"
              inputmode="numeric"
              step="1"
              min="5"
              :max="MAX_ROUND_LENGTH"
              :value="roundLengthSec"
              :disabled="disabled"
              @change="changeLength"
              @keydown.enter.prevent="$event.target.blur()"
            />
            <div>seconds per round</div>
          </div>
          <div class="st-item">
            <label for="showWordLength" class="st-checkbox-label">show word lengths</label>
            <KeyHint k="3" />
            <input
              id="showWordLength"
              type="checkbox"
              :checked="showWordLength"
              :disabled="disabled"
              @change="changeShowLength"
            />
          </div>
          <div class="st-item">
            <label for="finalDrawdown" class="st-checkbox-label">play the final drawdown</label>
            <KeyHint k="4" />
            <input id="finalDrawdown" type="checkbox" :checked="finalDrawdown" :disabled="disabled" @change="changeFinal" />
          </div>
          <div class="st-item">
            <label for="randomTeams" class="st-checkbox-label">random teams</label>
            <KeyHint k="5" />
            <input id="randomTeams" type="checkbox" :checked="randomTeams" :disabled="disabled" @change="changeRandom" />
          </div>
          <div class="st-item">
            <label for="headStart" class="st-checkbox-label">head start for the losing team</label>
            <KeyHint k="6" />
            <input id="headStart" type="checkbox" :checked="headStart" :disabled="disabled" @change="changeHeadStart" />
          </div>
          <div class="st-item">
            <label for="alwaysRotate" class="st-checkbox-label">drawers always rotate</label>
            <KeyHint k="7" />
            <input id="alwaysRotate" type="checkbox" :checked="alwaysRotate" :disabled="disabled" @change="changeRotate" />
          </div>
          <div class="st-item">
            <label for="allowLateJoin" class="st-checkbox-label">allow joining mid-game</label>
            <KeyHint k="8" />
            <input id="allowLateJoin" type="checkbox" :checked="allowLateJoin" :disabled="disabled" @change="changeLateJoin" />
          </div>
          <div class="st-item">
            <button class="st-rules-button" @click="rulesOpen = true">customize rules...</button>
            <span v-if="changedRules > 0" class="st-rules-changed">{{ changedRules }} changed</span>
          </div>
        </div>
      </div>
    </div>
    <RulesModal
      v-if="rulesOpen"
      :game-settings="gameSettings"
      :disabled="disabled"
      @update="send"
      @close-modal="rulesOpen = false"
    />
    <WordListSelectorModal
      v-if="modalOpen"
      :game-id="gameId"
      @select-list="
        (id) => {
          selectPack(id);
          modalOpen = false;
        }
      "
      @close-modal="modalOpen = false"
    />
  </div>
</template>
