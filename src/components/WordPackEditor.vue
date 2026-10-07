<script setup>
import { computed, ref, watch } from 'vue';
import {
  cleanWords,
  createPack,
  deletePack,
  exportPack,
  localPacks,
  parseFiles,
  savePacks,
  uploadPack,
} from '../localpacks.js';
import { fetchOfficialWords } from '../wordpacks.js';
import { safeStorage } from '../storage.js';
import Btn from './Btn.vue';

// gameId is set when the editor is used from a lobby: packs can then be picked for that game
const props = defineProps({ gameId: { type: String }, disabled: { type: Boolean, default: false } });
const emit = defineEmits(['use']);

const selectedUid = ref(localPacks[0]?.uid);
const selected = computed(() => localPacks.find((p) => p.uid === selectedUid.value));
const text = ref('');
const status = ref();
const statusKind = ref('info');
const busy = ref(false);
const importPreview = ref();
const fileInput = ref();
const COLUMN_CHOICES = [1, 2, 3, 4, 5];
const prefs = safeStorage('local');
// words per row: 1 = plain text box, 2-5 = a grid of editable words
const columns = ref(Math.min(5, Math.max(1, parseInt(prefs?.getItem('dbEditorCols') || '1', 10) || 1)));
const newWord = ref('');
const dirInput = ref();

const lines = computed(() => text.value.split('\n'));
const wordCount = computed(() =>
  columns.value > 1 && selected.value ? selected.value.words.length : cleanWords(lines.value).length,
);
const dupes = computed(() =>
  columns.value > 1 ? 0 : lines.value.map((l) => l.trim()).filter(Boolean).length - wordCount.value,
);

watch(
  selected,
  (p) => {
    text.value = p ? p.words.join('\n') : '';
  },
  { immediate: true },
);

function setColumns(n) {
  if (n === columns.value) return;
  // leaving the grid: refresh the text box from the (possibly edited) words
  if (columns.value > 1 && n === 1 && selected.value) text.value = selected.value.words.join('\n');
  columns.value = n;
  try {
    prefs?.setItem('dbEditorCols', String(n));
  } catch {
    // ignore
  }
}

function say(msg, kind = 'info') {
  status.value = msg;
  statusKind.value = kind;
}

// write the textarea back into the pack (cleaned)
function commit() {
  const p = selected.value;
  if (!p) return;
  p.words = cleanWords(columns.value > 1 ? p.words : lines.value);
  savePacks();
}
const currentWords = () => cleanWords(columns.value > 1 && selected.value ? selected.value.words : lines.value);
function onText(e) {
  text.value = e.target.value;
  const p = selected.value;
  if (p) {
    p.words = cleanWords(lines.value);
    savePacks();
  }
}
function tidy() {
  if (!selected.value) return;
  commit();
  text.value = selected.value.words.join('\n');
  say('removed blanks and duplicates');
}
function sortWords() {
  if (!selected.value) return;
  selected.value.words = currentWords().sort((a, b) => a.localeCompare(b));
  text.value = selected.value.words.join('\n');
  savePacks();
}
function shuffleWords() {
  if (!selected.value) return;
  const a = currentWords();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  selected.value.words = a;
  text.value = a.join('\n');
  savePacks();
}
function newPack() {
  const p = createPack({ name: 'new word pack' });
  selectedUid.value = p.uid;
}
function remove() {
  const p = selected.value;
  if (!p) return;
  deletePack(p);
  selectedUid.value = localPacks[0]?.uid;
}
// grid editing: changes go straight into the pack's word list
function onCell(i, e) {
  const p = selected.value;
  if (!p) return;
  const w = e.target.value.trim().replace(/\s+/g, ' ').slice(0, 40);
  const dup = p.words.some((x, j) => j !== i && x.toLowerCase() === w.toLowerCase());
  if (!w || dup) p.words.splice(i, 1);
  else p.words[i] = w;
  savePacks();
}
function removeWord(i) {
  const p = selected.value;
  if (!p) return;
  p.words.splice(i, 1);
  savePacks();
}
function addWord() {
  const p = selected.value;
  const w = newWord.value.trim().replace(/\s+/g, ' ').slice(0, 40);
  newWord.value = '';
  if (!p || !w) return;
  if (p.words.some((x) => x.toLowerCase() === w.toLowerCase())) {
    say(`"${w}" is already in the pack`, 'error');
    return;
  }
  p.words.unshift(w);
  savePacks();
}

// ---- cloning the official pack ----
async function cloneOfficial() {
  busy.value = true;
  try {
    const official = await fetchOfficialWords();
    const p = createPack({ name: `${official.name} (my copy)`, description: 'cloned from the official pack', words: official.words });
    selectedUid.value = p.uid;
    say(`cloned the official pack: ${p.words.length} words, edit away!`);
  } catch (e) {
    say(e.message, 'error');
  } finally {
    busy.value = false;
  }
}

function duplicate() {
  const p = selected.value;
  if (!p) return;
  selectedUid.value = createPack({ name: `${p.name} copy`, description: p.description, words: p.words }).uid;
}

// ---- importing files / whole directories ----
async function onFiles(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  busy.value = true;
  try {
    const { packs, errors, skipped } = await parseFiles(files);
    if (packs.length === 0) {
      say(errors[0] || 'no word lists found (looking for .txt .csv .json files)', 'error');
    } else {
      importPreview.value = packs.map((p) => ({ ...p, keep: true }));
      const extra = errors.length ? `, ${errors.length} file(s) had problems` : '';
      say(`found ${packs.length} word list${packs.length === 1 ? '' : 's'}${skipped ? `, ignored ${skipped} other file(s)` : ''}${extra}`);
    }
  } finally {
    busy.value = false;
    e.target.value = '';
  }
}
function confirmImport() {
  let last;
  let n = 0;
  for (const p of importPreview.value) {
    if (!p.keep) continue;
    last = createPack(p);
    n++;
  }
  importPreview.value = undefined;
  if (last) selectedUid.value = last.uid;
  say(`imported ${n} word pack${n === 1 ? '' : 's'}`);
}

// ---- using a pack in the current game ----
async function useInGame() {
  const p = selected.value;
  if (!p) return;
  commit();
  if (p.words.length < 4) {
    say('add at least 4 words first', 'error');
    return;
  }
  busy.value = true;
  try {
    const meta = await uploadPack(p);
    say(`using "${meta.name}" for this game`);
    emit('use', meta.id);
  } catch (e) {
    say(e.message, 'error');
  } finally {
    busy.value = false;
  }
}
async function shareId() {
  const p = selected.value;
  if (!p) return;
  commit();
  busy.value = true;
  try {
    const meta = await uploadPack(p);
    say(`word pack id: ${meta.id} (valid for 24h: use "enter a custom word pack id" in any lobby)`);
  } catch (e) {
    say(e.message, 'error');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="pe-root">
    <div class="pe-side">
      <div class="pe-side-title">my word packs</div>
      <button
        v-for="p in localPacks"
        :key="p.uid"
        class="pe-pack"
        :class="{ selected: p.uid === selectedUid }"
        @click="selectedUid = p.uid"
      >
        <div class="pe-pack-name">{{ p.name || 'untitled' }}</div>
        <div class="pe-pack-count">{{ p.words.length }} words</div>
      </button>
      <div v-if="localPacks.length === 0" class="pe-empty">no word packs yet</div>
      <div class="pe-side-actions">
        <button class="pe-link pe-clone" :disabled="busy" @click="cloneOfficial">clone official pack</button>
        <button class="pe-link" @click="newPack">+ new pack</button>
        <button class="pe-link" :disabled="busy" @click="fileInput.click()">import files</button>
        <button class="pe-link" :disabled="busy" @click="dirInput.click()">import folder</button>
      </div>
      <input ref="fileInput" type="file" multiple accept=".txt,.csv,.tsv,.json,.md,text/plain" hidden @change="onFiles" />
      <input ref="dirInput" type="file" webkitdirectory directory multiple hidden @change="onFiles" />
    </div>

    <div class="pe-main">
      <div v-if="importPreview" class="pe-import">
        <div class="pe-import-title">import from folder</div>
        <label v-for="(p, i) in importPreview" :key="i" class="pe-import-row">
          <input v-model="p.keep" type="checkbox" />
          <span class="pe-import-name">{{ p.name }}</span>
          <span class="pe-pack-count">{{ p.words.length }} words</span>
        </label>
        <div class="pe-actions">
          <Btn size="small" :force-rotation="-1" @click="confirmImport">import selected</Btn>
          <button class="pe-link" @click="importPreview = undefined">cancel</button>
        </div>
      </div>

      <template v-else-if="selected">
        <input v-model="selected.name" class="pe-name" maxlength="40" placeholder="word pack name" @input="savePacks" />
        <input
          v-model="selected.description"
          class="pe-desc"
          maxlength="120"
          placeholder="description (optional)"
          @input="savePacks"
        />
        <div class="pe-cols">
          <span class="pe-cols-label">words per row</span>
          <button
            v-for="n in COLUMN_CHOICES"
            :key="n"
            class="pe-col-btn"
            :class="{ on: columns === n }"
            :title="n === 1 ? 'plain text editor' : `${n} words per row`"
            @click="setColumns(n)"
          >
            {{ n }}
          </button>
        </div>
        <textarea
          v-if="columns === 1"
          class="pe-words"
          :value="text"
          placeholder="one word or phrase per line..."
          spellcheck="false"
          @input="onText"
        />
        <template v-else>
          <form class="pe-add" @submit.prevent="addWord">
            <input v-model="newWord" class="pe-add-input" maxlength="40" placeholder="add a word and press enter" />
            <button type="submit" class="pe-link" :disabled="!newWord.trim()">add</button>
          </form>
          <div class="pe-grid" :style="{ '--cols': columns }">
            <div v-for="(w, i) in selected.words" :key="w + i" class="pe-cell">
              <input class="pe-cell-input" :value="w" maxlength="40" spellcheck="false" @change="onCell(i, $event)" />
              <button class="pe-cell-x" title="remove" @click="removeWord(i)">&times;</button>
            </div>
          </div>
        </template>
        <div class="pe-meta">
          {{ wordCount }} word{{ wordCount === 1 ? '' : 's' }}
          <span v-if="dupes > 0" class="pe-warn"> · {{ dupes }} duplicate/blank</span>
          <span v-if="wordCount < 4" class="pe-warn"> · needs at least 4</span>
        </div>
        <div class="pe-tools">
          <button class="pe-link" @click="tidy">clean up</button>
          <button class="pe-link" @click="sortWords">sort a-z</button>
          <button class="pe-link" @click="shuffleWords">shuffle</button>
          <button class="pe-link" @click="duplicate">duplicate</button>
          <button class="pe-link" @click="exportPack(selected, 'json')">export .json</button>
          <button class="pe-link" @click="exportPack(selected, 'txt')">export .txt</button>
          <button class="pe-link pe-danger" @click="remove">delete</button>
        </div>
        <div class="pe-actions">
          <Btn
            v-if="gameId"
            :force-rotation="-1"
            :disabled="disabled || busy || wordCount < 4"
            @click="useInGame"
          >
            use in this game
          </Btn>
          <button class="pe-link" :disabled="busy || wordCount < 4" @click="shareId">get a shareable id</button>
        </div>
      </template>

      <div v-else class="pe-blank">
        <div>clone the official pack to start from, make a blank one, or import a folder of word lists</div>
        <div class="pe-help">
          .txt (one word per line), .csv (first column) and .json ({ "name", "words": [...] }) files are supported; every
          file in the folder becomes its own pack.
        </div>
        <div class="pe-actions">
          <Btn size="small" color="green" :force-rotation="-1" :disabled="busy" @click="cloneOfficial">clone official pack</Btn>
          <Btn size="small" :force-rotation="1" @click="newPack">new pack</Btn>
          <button class="pe-link" @click="dirInput.click()">import folder</button>
        </div>
      </div>
      <div v-if="status" class="pe-status" :class="statusKind">{{ status }}</div>
    </div>
  </div>
</template>
