<script setup>
import { computed, reactive } from 'vue';
import { DEFAULT_RULES } from '../shared.js';
import Modal from './Modal.vue';

const props = defineProps({
  gameSettings: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update', 'close-modal']);

const opts = (list, unit = '') => list.map((v) => ({ v, t: `${v}${unit}` }));

// every customisable rule: key, label, kind and options
const GROUPS = [
  {
    title: 'timing',
    items: [
      { key: 'chooseWordSec', label: 'time to choose a word', options: opts([5, 10, 15, 20, 30, 45, 60], 's') },
      { key: 'drawingCountdownSec', label: 'countdown before drawing', options: opts([1, 2, 3, 5, 8, 10], 's') },
      { key: 'roundEndSec', label: 'result screen length', options: opts([3, 5, 8, 10, 15], 's') },
      { key: 'startCountdownSec', label: 'game start countdown', options: opts([3, 5, 8, 10, 15], 's') },
      { key: 'finalWordDelaySec', label: 'final round: pause between words', options: opts([1, 2, 3, 5], 's') },
    ],
  },
  {
    title: 'scoring',
    items: [
      { key: 'pointsWin', label: 'points for guessing first', options: opts([100, 150, 200, 300, 500]) },
      { key: 'pointsCorrect', label: 'points for guessing second', options: opts([0, 50, 100, 150, 200]) },
      { key: 'finalWordPoints', label: 'final round: points per word', options: opts([50, 100, 150, 200, 300]) },
      { key: 'finalBonusPoints', label: 'final round: finishing bonus', options: opts([0, 100, 200, 300, 500]) },
      { key: 'headStartBase', label: 'head start after 2 wins in a row', options: [{ v: 0, t: 'off' }, ...opts([2, 3, 5, 8, 10], 's')] },
      { key: 'headStartStep', label: 'extra head start per extra win', options: opts([0, 1, 2, 3, 5], 's') },
      { key: 'alwaysRotate', label: 'drawers always rotate (winner does not stay)', bool: true },
    ],
  },
  {
    title: 'drawing',
    items: [
      { key: 'palette', label: 'colour palette', options: [{ v: 'full', t: 'full (10)' }, { v: 'basic', t: 'basic (5)' }, { v: 'mono', t: 'greys only' }] },
      { key: 'allowEraser', label: 'allow the eraser', bool: true },
      { key: 'allowClear', label: 'allow clearing the canvas', bool: true },
    ],
  },
  {
    title: 'guessing',
    items: [
      { key: 'wordChoiceCount', label: 'words to choose from', options: opts([2, 3, 4]) },
      { key: 'hintIntervalSec', label: 'reveal a letter every', options: [{ v: 0, t: 'never' }, ...opts([5, 10, 15, 20, 30], 's')] },
      { key: 'fuzzyMatch', label: 'forgive one typo (6+ letter words)', bool: true },
      { key: 'singleWordsOnly', label: 'only single-word answers', bool: true },
      { key: 'maxWordLength', label: 'longest word allowed', options: [{ v: 0, t: 'any' }, ...opts([6, 8, 10, 12, 15], ' letters')] },
    ],
  },
  {
    title: 'players',
    items: [
      { key: 'maxTeamSize', label: 'max players per team', options: opts([2, 3, 4, 5, 6, 8]) },
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
function numFrom(e, item) {
  const raw = e.target.value;
  const opt = item.options.find((o) => String(o.v) === raw);
  set(item.key, opt ? opt.v : raw);
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
          <select
            v-else
            :id="'rule-' + item.key"
            class="rm-select"
            :value="local[item.key]"
            :disabled="disabled"
            @change="numFrom($event, item)"
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
