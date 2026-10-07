<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { C } from '../shared.js';
import { SPECIAL_WORD_LIST_ID, isStandardPack, loadPack, packs } from '../wordpacks.js';
import { track } from '../analytics.js';
import { safeStorage } from '../storage.js';
import WordListSelectorItem from './WordListSelectorItem.vue';
import WordListSelectorModal from './WordListSelectorModal.vue';
import RulesModal from './RulesModal.vue';
import { DEFAULT_RULES } from '../shared.js';

const props = defineProps({
  gameId: { type: String, required: true },
  gameSettings: { type: Object, required: true },
  disabled: { type: Boolean, required: true },
});
const emit = defineEmits(['client-message']);

const ROUND_OPTIONS = [4, 6, 8, 10, 12, 15, 20, 25, 30, 40];
const ROUND_LENGTH_OPTIONS = [10, 15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300];

const storage = safeStorage('local');
const numRounds = ref(props.gameSettings.numRounds);
const roundLengthSec = ref(props.gameSettings.roundLengthSec);
const initialPack = props.gameSettings.wordListId;
const wordListId = ref(initialPack);
const showWordLength = ref(!props.gameSettings.hideWordLength);
const streamerMode = ref(props.gameSettings.streamerMode);
const copied = ref(false);
const modalOpen = ref(false);
const rulesOpen = ref(false);
const changedRules = computed(
  () => Object.keys(DEFAULT_RULES).filter((k) => props.gameSettings[k] !== undefined && props.gameSettings[k] !== DEFAULT_RULES[k]).length,
);
// a non-standard pack that was picked stays pinned at the top of the pack list
const customPack = ref(isStandardPack(initialPack) ? undefined : initialPack);

const inviteLink = computed(() => `${window.location.host}/${props.gameId.toUpperCase()}`);
const pack = computed(() => packs[wordListId.value]);
const roundOptions = computed(() =>
  ROUND_OPTIONS.filter((n) => pack.value === undefined || n <= pack.value.numWords / 2),
);

const send = (settings) => emit('client-message', [C.UpdateSettings, settings]);
const current = () => props.gameSettings;

function changeRounds(e) {
  const v = parseInt(e.target.value);
  track('change game setting', { 'game id': props.gameId, key: 'numRounds', value: v });
  numRounds.value = v;
  send({ ...current(), numRounds: v });
}
function changeLength(e) {
  const v = parseInt(e.target.value);
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
function changeStreamer(e) {
  const v = e.target.checked;
  track('change game setting', { 'game id': props.gameId, key: 'streamerMode', value: v });
  streamerMode.value = v;
  storage?.setItem('streamerMode', v ? '1' : '0');
  send({ ...current(), streamerMode: v });
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
  },
);
// pick a legal round count whenever the pack changes
watch(
  [roundOptions, numRounds],
  () => {
    if (roundOptions.value.length > 0 && !roundOptions.value.includes(numRounds.value)) {
      const v = Math.max(...roundOptions.value);
      numRounds.value = v;
      send({ ...current(), numRounds: v });
    }
  },
  { immediate: true },
);
watch(wordListId, (id) => {
  void loadPack(id);
  if (!isStandardPack(id)) customPack.value = id;
});

const listIds = computed(() => {
  const ids = [110943, SPECIAL_WORD_LIST_ID];
  if (customPack.value !== undefined) ids.unshift(customPack.value);
  return ids;
});
</script>

<template>
  <div class="st-table">
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
          <div v-if="roundOptions.length > 0" class="st-item">
            <select class="st-select" :value="numRounds" :disabled="disabled" @change="changeRounds">
              <option v-for="n in roundOptions" :key="n" :value="n">{{ n }}</option>
            </select>
            <div>rounds + the final drawdown</div>
          </div>
          <div v-else class="st-item st-not-enough-words">word pack needs more words!</div>
          <div class="st-item">
            <select class="st-select" :value="roundLengthSec" :disabled="disabled" @change="changeLength">
              <option v-for="n in ROUND_LENGTH_OPTIONS" :key="n" :value="n">{{ n }}</option>
            </select>
            <div>seconds per round</div>
          </div>
          <div class="st-item">
            <label for="showWordLength" class="st-checkbox-label">show word lengths</label>
            <input
              id="showWordLength"
              type="checkbox"
              :checked="showWordLength"
              :disabled="disabled"
              @change="changeShowLength"
            />
          </div>
          <div class="st-item">
            <button class="st-rules-button" @click="rulesOpen = true">customize rules...</button>
            <span v-if="changedRules > 0" class="st-rules-changed">{{ changedRules }} changed</span>
          </div>
          <div class="st-item">
            <label for="streamerMode" class="st-checkbox-label">
              streamer mode
              <div v-tooltip="{ content: 'this will hide the <nobr>game code</nobr>' }" class="st-question">
                (<span class="st-question-mark">?</span>)
              </div>
            </label>
            <input
              id="streamerMode"
              type="checkbox"
              :checked="streamerMode"
              :disabled="disabled"
              @change="changeStreamer"
            />
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
