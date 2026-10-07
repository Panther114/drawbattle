<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { JoinStatus } from '../shared.js';
import { API, loadPack, packs } from '../wordpacks.js';
import { track } from '../analytics.js';
import { takeJoinError } from '../nav.js';
import { safeStorage } from '../storage.js';
import Btn from '../components/Btn.vue';
import Footer from '../components/Footer.vue';
import HomeMarketing from '../components/HomeMarketing.vue';
import HomeWordPackUnit from '../components/HomeWordPackUnit.vue';

const props = defineProps({ wordListId: String });

const router = useRouter();
const storage = safeStorage('local');
const joinCode = ref('');
const createError = ref();
const joinError = ref();
const busy = ref(false);
const errorFromGame = takeJoinError();

watch(joinCode, (v) => {
  if (v !== v.trim()) joinCode.value = v.trim();
});

const listId = computed(() => (props.wordListId !== undefined ? parseInt(props.wordListId) : undefined));
const list = computed(() => (listId.value !== undefined ? packs[listId.value] : undefined));
onMounted(() => {
  if (listId.value !== undefined) void loadPack(listId.value);
});

function errorText(status, id) {
  const code = id.toUpperCase();
  switch (status) {
    case JoinStatus.Nonexistent:
      return `game ${code} doesn't exist`;
    case JoinStatus.Started:
      return `game ${code} already started. sorry!`;
    case JoinStatus.Full:
      return `game ${code} is full. sorry!`;
    default:
      return '';
  }
}

async function newGame() {
  if (busy.value) return;
  track('click new game button', { 'word list id': listId.value });
  busy.value = true;
  createError.value = undefined;
  const res = await fetch(`${API}/games`, {
    body: JSON.stringify({
      wordListId: props.wordListId,
      streamerMode: storage?.getItem('streamerMode') === '1' || undefined,
    }),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  busy.value = false;
  if (res.status >= 400) {
    const text = await res.text();
    createError.value = text.length > 0 ? text : 'something went wrong';
    return;
  }
  const data = await res.json();
  router.push({ name: 'Game', params: { gameId: data.gameId.toUpperCase() } });
}

async function joinGame() {
  if (busy.value) return;
  track('click join game button', { 'game id': joinCode.value });
  busy.value = true;
  const res = await fetch(`${API}/games/${joinCode.value}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  busy.value = false;
  if (res.status === 200) router.push({ name: 'Game', params: { gameId: joinCode.value.toUpperCase() } });
  else joinError.value = [JoinStatus.Nonexistent, joinCode.value];
}
</script>

<template>
  <div class="hm-root">
    <div v-if="errorFromGame" class="hm-join-error-from-game">{{ errorText(errorFromGame.status, errorFromGame.gameId) }}</div>
    <div class="hm-title">draw battle!</div>
    <div class="hm-tagline">two teams of drawers face off with a frantic final round</div>
    <HomeWordPackUnit v-if="listId !== undefined" :word-list="list" />
    <HomeMarketing v-else class="hm-marketing-pos" />
    <div class="hm-button-row">
      <div class="hm-new-game-wrapper">
        <Btn type="submit" :force-rotation="-3" @click="newGame">new game</Btn>
        <div v-if="list !== undefined" class="hm-word-list-edition">
          <span class="hm-word-list-name">{{ list.name }}</span> word pack
        </div>
        <div v-if="createError !== undefined" class="hm-create-error">{{ createError }}</div>
      </div>
      <form class="hm-join-game" @submit.prevent="joinGame">
        <input
          v-model="joinCode"
          type="text"
          class="hm-join-input"
          placeholder="enter 4-letter code"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <div class="hm-join-input-line" />
        <div v-if="joinError" class="hm-inline-join-error">{{ errorText(joinError[0], joinError[1]) }}</div>
        <Btn type="submit" :disabled="joinCode.length !== 4" :force-rotation="3" color="purple" class="hm-join-button">
          join game
        </Btn>
      </form>
    </div>
    <div class="hm-how-header">how to play</div>
    <div class="hm-how">
      <div class="hm-how-row">
        <div class="hm-how-icon team" />
        <div class="hm-how-text">split up into two teams of 2 or <span class="hm-nobr">more players</span></div>
      </div>
      <div class="hm-how-row">
        <div class="hm-how-icon draw" />
        <div class="hm-how-text">draw and guess each word before the <span class="hm-nobr">other team</span></div>
      </div>
      <div class="hm-how-row">
        <div class="hm-how-icon replay" />
        <div class="hm-how-text">replay the same words again in a frantic <span class="hm-nobr">final round</span></div>
      </div>
    </div>
    <Footer />
  </div>
</template>
