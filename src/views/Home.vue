<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { JoinStatus } from '../shared.js';
import { Prio, useKeys } from '../keys.js';
import { API, loadPack, packs } from '../wordpacks.js';
import { track } from '../analytics.js';
import { takeJoinError } from '../nav.js';
import { safeStorage } from '../storage.js';
import Btn from '../components/Btn.vue';
import Icon from '../components/Icon.vue';
import KeyHint from '../components/KeyHint.vue';
import TopNav from '../components/TopNav.vue';
import HomeMarketing from '../components/HomeMarketing.vue';
import HomeWordPackUnit from '../components/HomeWordPackUnit.vue';

const props = defineProps({ wordListId: String });

const router = useRouter();
const storage = safeStorage('local');
const joinCode = ref('');
const createError = ref();
const joinError = ref();
const busy = ref(false);
const picking = ref(false); // the "choose a game code" panel under the new game button
const newCode = ref('');
const codeInput = ref();
const joinInput = ref();
const errorFromGame = takeJoinError();
// the title drops in letter by letter, each from its own little tilt
const TITLE = [...'draw battle!'].map((ch, i) => ({ ch, tilt: `${((i * 7) % 5) * 6 - 12}deg` }));

watch(joinCode, (v) => {
  if (v !== v.trim()) joinCode.value = v.trim();
  joinError.value = undefined; // typing a new code clears the old "doesn't exist" message
});

watch(newCode, (v) => {
  const clean = v.toLowerCase().replace(/[^a-z]/g, '').slice(0, 4);
  if (clean !== v) newCode.value = clean;
  createError.value = undefined;
});

function randomCode() {
  let c = '';
  for (let i = 0; i < 4; i++) c += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  newCode.value = c;
}
function togglePicker() {
  picking.value = !picking.value;
  createError.value = undefined;
  if (picking.value) nextTick(() => codeInput.value?.focus());
}

const previewing = ref(false);
useKeys([
  { key: 'n', run: togglePicker },
  { key: 'j', run: () => joinInput.value?.focus() },
  { key: 'l', run: () => router.push('/lobbies') },
  { key: 'w', run: () => router.push('/wordpacks') },
  // the pack preview is the list on the right under the pack name
  { key: 'p', when: () => list.value !== undefined && list.value.numWords > 0, run: () => (previewing.value = !previewing.value) },
  { key: 'esc', typing: true, prio: Prio.page, when: () => picking.value, run: togglePicker },
]);

const listId = computed(() => (props.wordListId !== undefined ? parseInt(props.wordListId) : undefined));
const list = computed(() => (listId.value !== undefined ? packs[listId.value] : undefined));
onMounted(() => {
  if (listId.value !== undefined) void loadPack(listId.value);
});

function errorText(status, id, reason) {
  const code = id.toUpperCase();
  switch (status) {
    case JoinStatus.Nonexistent:
      return `game ${code} doesn't exist`;
    case JoinStatus.Started:
      return `game ${code} already started. sorry!`;
    case JoinStatus.Full:
      return `game ${code} is full. sorry!`;
    case JoinStatus.Kicked:
      return `you were vote-kicked from game ${code}`;
    case JoinStatus.Closed:
      return reason === 'spectators' ? `game ${code} doesn't allow spectators` : `game ${code} doesn't allow late joiners`;
    default:
      return '';
  }
}

async function newGame() {
  if (busy.value) return;
  track('click new game button', { 'word list id': listId.value });
  busy.value = true;
  createError.value = undefined;
  let res;
  try {
    res = await fetch(`${API}/games`, {
      body: JSON.stringify({
        wordListId: props.wordListId,
        code: newCode.value || undefined,
        streamerMode: storage?.getItem('streamerMode') === '1' || undefined,
      }),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    busy.value = false; // network failure: unlock the buttons again
    createError.value = 'could not reach the server';
    return;
  }
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
  let res;
  try {
    res = await fetch(`${API}/games/${encodeURIComponent(joinCode.value)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    busy.value = false; // network failure: unlock the buttons again
    return;
  }
  busy.value = false;
  if (res.status === 200) router.push({ name: 'Game', params: { gameId: joinCode.value.toUpperCase() } });
  else joinError.value = [JoinStatus.Nonexistent, joinCode.value];
}
</script>

<template>
  <div class="hm-root">
    <TopNav>
      <router-link to="/lobbies" class="nav-lobbies"><Icon name="people" />lobbies<KeyHint k="l" /></router-link>
      <router-link to="/wordpacks" class="nav-editor"><Icon name="pencil" />word pack editor<KeyHint k="w" /></router-link>
    </TopNav>
    <div v-if="errorFromGame" class="hm-join-error-from-game">{{ errorText(errorFromGame.status, errorFromGame.gameId, errorFromGame.reason) }}</div>
    <div class="hm-title">
      <span class="hm-title-text" role="heading" aria-level="1" aria-label="draw battle! Gavania edition"
        ><span v-for="(l, i) in TITLE" :key="i" class="hm-letter" aria-hidden="true" :style="{ '--i': i, '--r': l.tilt }">{{ l.ch }}</span
        ><span class="hm-edition" aria-hidden="true">Gavania edition</span></span
      >
    </div>
    <div class="hm-tagline">two teams of drawers face off with a frantic final round</div>
    <HomeWordPackUnit v-if="listId !== undefined" v-model:open="previewing" :word-list="list" />
    <HomeMarketing v-else class="hm-marketing-pos" />
    <div class="hm-button-row">
      <div class="hm-new-game-wrapper">
        <Btn type="button" :force-rotation="-3" icon="sparkle" hint="n" @click="togglePicker">new game</Btn>
        <Transition name="hm-pop">
          <form v-if="picking" class="hm-picker" @submit.prevent="newGame">
            <div class="hm-picker-label">pick a game code</div>
            <div class="hm-picker-row">
              <input
                ref="codeInput"
                v-model="newCode"
                type="text"
                class="hm-code-input"
                placeholder="abcd"
                maxlength="4"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
              />
              <button type="button" class="hm-dice" @click="randomCode">random</button>
            </div>
            <div class="hm-picker-hint">4 letters, or leave it empty for a surprise</div>
            <Btn type="submit" size="small" color="green" :force-rotation="2" icon="play" :disabled="busy">
              {{ newCode.length === 4 ? `create ${newCode.toUpperCase()}` : 'create game' }}
            </Btn>
          </form>
        </Transition>
        <div v-if="list !== undefined && !picking" class="hm-word-list-edition">
          <span class="hm-word-list-name">{{ list.name }}</span> word pack
        </div>
        <div v-if="createError !== undefined" class="hm-create-error">{{ createError }}</div>
      </div>
      <form class="hm-join-game" @submit.prevent="joinGame">
        <input
          ref="joinInput"
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
        <Btn type="submit" :disabled="joinCode.length !== 4 || busy" :force-rotation="3" color="purple" icon="enter" class="hm-join-button" :hint="joinCode.length === 4 ? 'enter' : 'j'">
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
  </div>
</template>
