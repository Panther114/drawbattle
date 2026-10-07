<script setup>
import { nextTick, onMounted, ref } from 'vue';
import { communityIds, loadCommunityPacks, loadPack, officialIds, packs } from '../wordpacks.js';
import { track } from '../analytics.js';
import Modal from './Modal.vue';
import WordListSelectorItem from './WordListSelectorItem.vue';

const props = defineProps({ gameId: { type: String, required: true } });
const emit = defineEmits(['close-modal', 'select-list']);

const tab = ref('official');

// custom word pack id entry
const entering = ref(false);
const idInput = ref();
const customError = ref();

function openCustom() {
  entering.value = !entering.value;
  nextTick(() => idInput.value?.focus());
}
async function submitCustom(e) {
  e.preventDefault();
  const id = parseInt(idInput.value.value.trim());
  track('submit custom word pack id', { 'game id': props.gameId, 'word list id': id });
  if (Number.isNaN(id)) {
    customError.value = 'invalid input';
    return;
  }
  customError.value = undefined;
  await loadPack(id);
  if (packs[id] !== undefined) emit('select-list', id);
  else customError.value = 'word list not found';
}

onMounted(() => {
  void loadCommunityPacks();
});
function clickTab(name) {
  tab.value = name;
  track('click word pack modal tab', { 'game id': props.gameId, tab: name });
}
function clickDiscord() {
  track('click word pack discord link', { 'game id': props.gameId });
}
</script>

<template>
  <Modal @close-modal="emit('close-modal')">
    <div class="wp-modal">
      <div class="wp-tabs">
        <button class="wp-tab" :class="{ selected: tab === 'official' }" @click="clickTab('official')">
          official packs
        </button>
        <button class="wp-tab" :class="{ selected: tab === 'community' }" @click="clickTab('community')">
          community packs
          <div class="wp-tab-new">new!</div>
        </button>
      </div>
      <div v-if="tab === 'official'">
        <template v-for="id in officialIds" :key="id">
          <WordListSelectorItem v-if="packs[id] !== undefined" :word-list-id="id" @select-list="emit('select-list', id)" />
        </template>
      </div>
      <div v-else>
        <div class="wp-custom-text">
          <div class="wp-custom">
            <div v-if="entering">
              <form @submit="submitCustom">
                <input ref="idInput" type="text" placeholder="6-digit word pack id" class="wp-custom-input" />
                <button type="submit" class="wp-custom-submit">enter</button>
                <button type="button" class="wp-custom-cancel" @click="entering = false">cancel</button>
              </form>
              <div v-if="customError !== undefined" class="wp-custom-error">{{ customError }}</div>
            </div>
            <button v-else class="wp-custom-button" @click="openCustom">enter a custom word pack id</button>
          </div>
          <div>
            browse 100+ more packs or make your own in our
            <a href="https://discord.gg/gWsU2uAfY9" target="_blank" rel="noreferrer" class="wp-discord-link" @click="clickDiscord">discord</a>
          </div>
        </div>
        <div v-if="communityIds !== undefined">
          <WordListSelectorItem
            v-for="id in communityIds"
            :key="id"
            :word-list-id="id"
            @select-list="emit('select-list', id)"
          />
        </div>
        <div class="wp-custom-text">
          find 100+ more community packs in the
          <a href="https://discord.gg/gWsU2uAfY9" target="_blank" rel="noreferrer" class="wp-discord-link" @click="clickDiscord">word packs channel</a>
        </div>
      </div>
    </div>
  </Modal>
</template>
