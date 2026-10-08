<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { DEFAULT_URL, addBind, cancelCapture, captureBind, chooseFile, clearFile, normalizeUrl, qs, removeBind, resetBinds, saveSettings, toggleQuick } from '../quickswitch.js';
import Icon from '../components/Icon.vue';
import TopNav from '../components/TopNav.vue';

const urlText = ref(qs.url);
const urlOk = computed(() => normalizeUrl(urlText.value) !== undefined);
const fileMsg = ref('');
const fileInput = ref();

function commitUrl() {
  const u = normalizeUrl(urlText.value);
  if (u === undefined) {
    urlText.value = qs.url;
    return;
  }
  qs.url = u;
  urlText.value = u;
  saveSettings();
}
function resetUrl() {
  urlText.value = DEFAULT_URL;
  commitUrl();
}
function setMode(m) {
  qs.mode = m;
  saveSettings();
}
async function pickFile(e) {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  fileMsg.value = (await chooseFile(f)) ?? '';
}
async function removeFile() {
  fileMsg.value = '';
  await clearFile();
}
const change = () => saveSettings();
const bindMsg = ref('');
async function addKey() {
  if (qs.capturing) return cancelCapture();
  bindMsg.value = '';
  const b = await captureBind();
  if (b) bindMsg.value = addBind(b) ?? '';
}
onBeforeUnmount(cancelCapture);
const canTest = computed(() => qs.enabled && (qs.mode === 'site' ? urlOk.value : !!qs.blobUrl));
function test() {
  if (qs.mode === 'site') commitUrl();
  toggleQuick();
}
</script>

<template>
  <div class="stt-root qsw-root">
    <TopNav><router-link to="/" class="nav-home"><Icon name="home" />back to home</router-link></TopNav>
    <div class="stt-title">quick switch</div>
    <div class="stt-sub">a hotkey that instantly covers the game with a page you pick. kept only in this browser</div>

    <div class="qsw-card">
      <div class="qsw-row">
        <label class="qsw-label" for="qsEnabled"><Icon name="bolt" class="stt-ic c-purple" />turn quick switch on</label>
        <input id="qsEnabled" v-model="qs.enabled" type="checkbox" @change="change" />
      </div>
      <div class="qsw-hint">on any page, the hotkeys below show your page full screen. press one again to go back. your teammates see a sleepy icon next to your name while it is open.</div>
    </div>

    <div class="qsw-card" :class="{ off: !qs.enabled }">
      <div class="qsw-title">what to show</div>
      <div class="qsw-choice">
        <button class="qsw-pill" :class="{ on: qs.mode === 'site' }" @click="setMode('site')"><Icon name="code" />website</button>
        <button class="qsw-pill" :class="{ on: qs.mode === 'file' }" @click="setMode('file')"><Icon name="list" />local file</button>
      </div>

      <template v-if="qs.mode === 'site'">
        <div class="qsw-line">
          <input
            v-model="urlText"
            class="qsw-input"
            :class="{ bad: !urlOk }"
            type="text"
            inputmode="url"
            spellcheck="false"
            autocomplete="off"
            placeholder="https://chat.deepseek.com"
            @change="commitUrl"
            @keydown.enter.prevent="$event.target.blur()"
          />
          <button class="qsw-small" :disabled="urlText === DEFAULT_URL" @click="resetUrl">default</button>
        </div>
        <div class="qsw-hint">the page loads quietly in the background as soon as you are in a game, so it appears instantly.</div>
      </template>
      <template v-else>
        <div class="qsw-line">
          <button class="qsw-small" @click="fileInput.click()">{{ qs.file ? 'change file' : 'choose a file' }}</button>
          <span class="qsw-file">{{ qs.file ? qs.file.name : 'no file chosen (.html or .pdf)' }}</span>
          <button v-if="qs.file" class="qsw-small" @click="removeFile"><Icon name="trash" />remove</button>
        </div>
        <input ref="fileInput" type="file" accept=".html,.htm,.pdf,text/html,application/pdf" hidden @change="pickFile" />
        <div v-if="fileMsg" class="qsw-warn">{{ fileMsg }}</div>
        <div class="qsw-hint">the file is stored in this browser only and never uploaded anywhere.</div>
      </template>
    </div>

    <div class="qsw-card" :class="{ off: !qs.enabled }">
      <div class="qsw-title">how it opens</div>
      <div class="qsw-choice">
        <button class="qsw-pill" :class="{ on: qs.display === 'frame' }" @click="qs.display = 'frame'; change()"><Icon name="eye" />cover the page</button>
        <button class="qsw-pill" :class="{ on: qs.display === 'popup' }" @click="qs.display = 'popup'; change()"><Icon name="enter" />pop-up window</button>
      </div>
      <div class="qsw-hint">
        some websites refuse to be shown inside another page and look blank or broken. if that happens, pick pop-up window: it opens the page in its own
        screen-sized window (allow pop-ups for this site).
      </div>
      <div v-if="qs.popupBlocked" class="qsw-warn">the browser blocked the pop-up. allow pop-ups for this site and try again.</div>
    </div>

    <div class="qsw-card" :class="{ off: !qs.enabled }">
      <div class="qsw-title">hotkeys (on every page)</div>
      <div class="qsw-chips">
        <span v-for="(b, i) in qs.binds" :key="i" class="qsw-chip">
          <Icon :name="b.t === 'm' ? 'enter' : 'list'" />{{ b.label }}
          <button class="qsw-x" :aria-label="'remove ' + b.label" @click="removeBind(i)">&times;</button>
        </span>
        <span v-if="!qs.binds.length" class="qsw-hint">no hotkeys: use the button in the corner of a game</span>
      </div>
      <div class="qsw-line">
        <button class="qsw-small" :class="{ listening: qs.capturing }" @click="addKey">{{ qs.capturing ? 'press a key or mouse button... (Esc cancels)' : 'add a hotkey' }}</button>
        <button class="qsw-small" @click="resetBinds">back to the defaults</button>
      </div>
      <div v-if="bindMsg" class="qsw-warn">{{ bindMsg }}</div>
      <div class="qsw-hint">press any key (no Ctrl, Alt or Shift) or a mouse button (middle, back, forward). These are taken over on every page of the game, so they no longer move focus or go back a page. Left and right clicks can't be used.</div>
    </div>

    <div class="qsw-foot">
      <button class="qsw-test" :disabled="!canTest" @click="test"><Icon name="play" />try it now</button>
      <div class="qsw-hint">click the small bolt in the top corner to come back. inside a game the hotkey works too, until you click into a website: from then on use the bolt button.</div>
    </div>
  </div>
</template>
