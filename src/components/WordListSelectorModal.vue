<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { globalIds, loadGlobalPacks, loadPack, officialIds, packs } from '../wordpacks.js';
import { track } from '../analytics.js';
import { Prio, useKeys } from '../keys.js';
import KeyHint from './KeyHint.vue';
import Modal from './Modal.vue';
import WordPackEditor from './WordPackEditor.vue';
import WordListSelectorItem from './WordListSelectorItem.vue';

const props = defineProps({ gameId: { type: String, required: true } });
const emit = defineEmits(['close-modal', 'select-list']);

const tab = ref('official');

// custom word pack id entry
const entering = ref(false);
const idInput = ref();
const customError = ref();
const checking = ref(false);

function openCustom() {
  entering.value = !entering.value;
  nextTick(() => idInput.value?.focus());
}
async function submitCustom(e) {
  e.preventDefault();
  if (checking.value) return;
  const id = parseInt(idInput.value.value.trim());
  track('submit custom word pack id', { 'game id': props.gameId, 'word list id': id });
  if (Number.isNaN(id)) {
    customError.value = 'invalid input';
    return;
  }
  customError.value = undefined;
  checking.value = true;
  try {
    await loadPack(id);
  } finally {
    checking.value = false;
  }
  if (packs[id] !== undefined) emit('select-list', id);
  else customError.value = 'word list not found';
}

watch(
  tab,
  (t) => {
    if (t === 'community') void loadGlobalPacks();
  },
  { immediate: true },
);

function clickTab(name) {
  tab.value = name;
  track('click word pack modal tab', { 'game id': props.gameId, tab: name });
}

// ---- keyboard: arrows flip the tabs, a digit picks the pack with that number, C types a custom id ----
const TABS = ['official', 'community', 'mine'];
const listed = computed(() => (tab.value === 'official' ? officialIds.value : tab.value === 'community' ? globalIds.value : []).filter((id) => packs[id] !== undefined));
const hintFor = (id) => (listed.value.indexOf(id) >= 0 && listed.value.indexOf(id) < 9 ? String(listed.value.indexOf(id) + 1) : '');
const stepTab = (d) => clickTab(TABS[(TABS.indexOf(tab.value) + d + TABS.length) % TABS.length]);
useKeys(
  [
    { key: 'left', run: () => stepTab(-1) },
    { key: 'right', run: () => stepTab(1) },
    { key: 'c', when: () => tab.value === 'official', run: openCustom },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
      key: String(n),
      when: () => listed.value[n - 1] !== undefined,
      run: () => emit('select-list', listed.value[n - 1]),
    })),
  ],
  { prio: Prio.overlay, modal: true },
);
</script>

<template>
  <Modal :wide="tab === 'mine'" @close-modal="emit('close-modal')">
    <div class="wp-modal">
      <div class="wp-tabs">
        <button class="wp-tab" :class="{ selected: tab === 'official' }" @click="clickTab('official')">
          official pack
        </button>
        <button class="wp-tab" :class="{ selected: tab === 'community' }" @click="clickTab('community')">community</button>
        <button class="wp-tab" :class="{ selected: tab === 'mine' }" @click="clickTab('mine')">my packs</button>
      </div>
      <div v-if="tab === 'official'">
        <template v-for="id in officialIds" :key="id">
          <WordListSelectorItem v-if="packs[id] !== undefined" :word-list-id="id" :hint="hintFor(id)" @select-list="emit('select-list', id)" />
        </template>
        <div class="wp-custom-text">
          <div class="wp-custom">
            <div v-if="entering">
              <form @submit="submitCustom">
                <input ref="idInput" type="text" placeholder="6-digit word pack id" class="wp-custom-input" />
                <button type="submit" class="wp-custom-submit" :disabled="checking">enter</button>
                <button type="button" class="wp-custom-cancel" @click="entering = false">cancel</button>
              </form>
              <div v-if="customError !== undefined" class="wp-custom-error">{{ customError }}</div>
            </div>
            <button v-else class="wp-custom-button" @click="openCustom">enter a custom word pack id<KeyHint k="c" /></button>
          </div>
        </div>
      </div>
      <div v-else-if="tab === 'community'">
        <template v-for="id in globalIds" :key="id">
          <WordListSelectorItem v-if="packs[id] !== undefined" :word-list-id="id" :hint="hintFor(id)" @select-list="emit('select-list', id)" />
        </template>
        <div v-if="globalIds.length === 0" class="wp-community-empty">
          nobody has shared a word pack yet. make one in "my packs" and share it with everyone!
        </div>
      </div>
      <WordPackEditor v-else :game-id="gameId" @use="(id) => emit('select-list', id)" />
    </div>
  </Modal>
</template>
