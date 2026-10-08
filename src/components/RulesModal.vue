<script setup>
import { computed, reactive } from 'vue';
import { DEFAULT_RULES } from '../shared.js';
import Modal from './Modal.vue';

const props = defineProps({
  gameSettings: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update', 'close-modal']);

// number rules: [min, max] are enforced here and again on the server; `zero` explains what 0 does
const num = (key, label, min, max, unit = '', zero) => ({ key, label, num: true, min, max, unit, zero });

// every customisable rule: key, label and kind
const GROUPS = [
  {
    title: 'game',
    items: [{ key: 'finalDrawdown', label: 'play the final drawdown (off: the game ends after the last round)', bool: true }],
  },
  {
    title: 'timing',
    items: [
      num('chooseWordSec', 'time to choose a word', 3, 120, 'sec'),
      num('drawingCountdownSec', 'countdown before drawing', 1, 15, 'sec'),
      num('roundEndSec', 'result screen length', 2, 20, 'sec'),
      num('startCountdownSec', 'game start countdown', 3, 20, 'sec'),
      num('finalWordDelaySec', 'final round: pause between words', 1, 10, 'sec'),
    ],
  },
  {
    title: 'scoring',
    items: [
      num('pointsWin', 'points for guessing first', 0, 10000, 'pts'),
      num('pointsCorrect', 'points for guessing second', 0, 10000, 'pts'),
      num('finalWordPoints', 'final round: points per word', 0, 10000, 'pts'),
      num('finalBonusPoints', 'final round: finishing bonus', 0, 10000, 'pts'),
      num('headStartBase', 'head start after 2 wins in a row', 0, 30, 'sec', 'off'),
      num('headStartStep', 'extra head start per extra win', 0, 10, 'sec'),
      { key: 'alwaysRotate', label: 'drawers always rotate (winner does not stay)', bool: true },
    ],
  },
  {
    title: 'drawing',
    items: [
      {
        key: 'palette',
        label: 'colour palette',
        options: [
          { v: 'full', t: 'full (10)' },
          { v: 'basic', t: 'basic (5)' },
          { v: 'mono', t: 'greys only' },
        ],
      },
      { key: 'allowEraser', label: 'allow the eraser', bool: true },
      { key: 'allowClear', label: 'allow clearing the canvas', bool: true },
    ],
  },
  {
    title: 'guessing',
    items: [
      num('wordChoiceCount', 'words to choose from', 2, 4),
      num('hintIntervalSec', 'reveal a letter every', 0, 120, 'sec', 'never'),
      { key: 'fuzzyMatch', label: 'forgive one typo (6+ letter words)', bool: true },
      { key: 'singleWordsOnly', label: 'only single-word answers', bool: true },
      num('maxWordLength', 'longest word allowed', 0, 40, 'letters', 'any'),
    ],
  },
  {
    title: 'players',
    items: [
      num('maxTeamSize', 'max players per team', 2, 8),
      { key: 'allowSpectators', label: 'allow spectators', bool: true },
      { key: 'allowLateJoin', label: 'allow joining after the game starts', bool: true },
    ],
  },
];

const PRESETS = {
  classic: { label: 'classic', values: { ...DEFAULT_RULES } },
  speedy: {
    label: 'speedy',
    values: { chooseWordSec: 8, drawingCountdownSec: 2, roundEndSec: 3, startCountdownSec: 3, finalWordDelaySec: 1, headStartBase: 2 },
  },
  chill: {
    label: 'chill',
    values: { chooseWordSec: 30, hintIntervalSec: 15, fuzzyMatch: true, pointsCorrect: 150, headStartBase: 0, drawingCountdownSec: 5 },
  },
  chaos: {
    label: 'chaos',
    values: { wordChoiceCount: 4, palette: 'mono', allowEraser: false, allowClear: false, alwaysRotate: true, pointsWin: 500, pointsCorrect: 0, headStartBase: 0 },
  },
};

// local copy so quick successive changes do not overwrite each other before the server echoes
const local = reactive({});
for (const k of Object.keys(DEFAULT_RULES)) {
  const v = props.gameSettings[k];
  local[k] = typeof v === typeof DEFAULT_RULES[k] ? v : DEFAULT_RULES[k];
}
const changed = computed(() => Object.keys(DEFAULT_RULES).filter((k) => local[k] !== DEFAULT_RULES[k]).length);

function push() {
  emit('update', { ...props.gameSettings, ...local });
}
function set(key, value) {
  local[key] = value;
  push();
}
function applyPreset(p) {
  Object.assign(local, DEFAULT_RULES, p.values);
  push();
}
function selectFrom(e, item) {
  const raw = e.target.value;
  const opt = item.options.find((o) => String(o.v) === raw);
  set(item.key, opt ? opt.v : raw);
}
// whole numbers only, clamped into the rule's range; a bad entry snaps back to the current value
function numFrom(e, item) {
  const n = Math.round(Number(e.target.value));
  const v = e.target.value.trim() === '' || !Number.isFinite(n) ? local[item.key] : Math.min(item.max, Math.max(item.min, n));
  e.target.value = v;
  set(item.key, v);
}
</script>

<template>
  <Modal @close-modal="emit('close-modal')">
    <div class="rm-root">
      <div class="rm-title">customize rules</div>
      <div class="rm-presets">
        <span class="rm-presets-label">presets</span>
        <button v-for="(p, k) in PRESETS" :key="k" class="rm-preset" :disabled="disabled" @click="applyPreset(p)">
          {{ p.label }}
        </button>
      </div>
      <div v-for="g in GROUPS" :key="g.title" class="rm-group">
        <div class="rm-group-title">{{ g.title }}</div>
        <div v-for="item in g.items" :key="item.key" class="rm-row">
          <label :for="'rule-' + item.key" class="rm-label">{{ item.label }}</label>
          <input
            v-if="item.bool"
            :id="'rule-' + item.key"
            type="checkbox"
            :checked="local[item.key]"
            :disabled="disabled"
            @change="set(item.key, $event.target.checked)"
          />
          <span v-else-if="item.num" class="rm-num-wrap">
            <input
              :id="'rule-' + item.key"
              class="rm-num"
              type="number"
              inputmode="numeric"
              step="1"
              :min="item.min"
              :max="item.max"
              :value="local[item.key]"
              :disabled="disabled"
              @change="numFrom($event, item)"
              @keydown.enter.prevent="$event.target.blur()"
            />
            <span class="rm-unit">{{ local[item.key] === 0 && item.zero ? item.zero : item.unit }}</span>
          </span>
          <select
            v-else
            :id="'rule-' + item.key"
            class="rm-select"
            :value="local[item.key]"
            :disabled="disabled"
            @change="selectFrom($event, item)"
          >
            <option v-for="o in item.options" :key="o.v" :value="o.v">{{ o.t }}</option>
          </select>
        </div>
      </div>
      <div class="rm-foot">
        <span v-if="changed > 0" class="rm-changed">{{ changed }} rule{{ changed === 1 ? '' : 's' }} changed</span>
        <button v-if="changed > 0" class="rm-reset" :disabled="disabled" @click="applyPreset(PRESETS.classic)">
          reset to defaults
        </button>
      </div>
    </div>
  </Modal>
</template>
