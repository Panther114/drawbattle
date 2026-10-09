<script setup>
import { computed, ref, watch } from 'vue';
import { MAX_NAME_LENGTH, UserStatus, cleanNameInput, containsYouTag, displayName, sanitizeName } from '../shared.js';
import { safeStorage } from '../storage.js';
import Btn from './Btn.vue';

const props = defineProps({
  users: { type: Object, required: true },
  teams: { type: Array, default: () => [] },
  canLateJoin: { type: Boolean, default: false },
  pickTeam: { type: Boolean, default: false },
  maxTeamSize: { type: Number, default: 8 },
  initName: { type: String },
});
const emit = defineEmits(['join-game', 'late-join', 'spectate-game']);

const storage = safeStorage('local');
const name = ref(sanitizeName(props.initName ?? storage?.getItem('userName') ?? ''));
watch(name, (v) => {
  if (containsYouTag(v)) name.value = cleanNameInput(v);
});
const cleanName = computed(() => sanitizeName(name.value));
const hasRoom = (t) => t.userIds.length < props.maxTeamSize;

function joinLate(team) {
  if (!cleanName.value) return;
  storage?.setItem('userName', cleanName.value);
  emit('late-join', { name: cleanName.value, team });
}
</script>

<template>
  <div class="jd-root">
    <div class="jd-title">game in progress!</div>
    <template v-for="u in users" :key="u.id">
      <div v-if="u.status === UserStatus.Disconnected">
        <Btn class="jd-join" @click="$emit('join-game', u.id)">rejoin as {{ displayName(u) }}</Btn>
      </div>
    </template>
    <form v-if="canLateJoin" class="jd-late" @submit.prevent="joinLate(undefined)">
      <label class="jd-late-label" for="lateName">join as a new player</label>
      <input
        id="lateName"
        v-model="name"
        type="text"
        class="lobby-name-input jd-name"
        placeholder="my name is"
        :maxlength="MAX_NAME_LENGTH"
        autocorrect="off"
        spellcheck="false"
      />
      <div v-if="pickTeam" class="jd-teams">
        <Btn
          v-for="(t, ti) in teams"
          :key="ti"
          type="button"
          color="purple"
          :force-rotation="ti % 2 === 0 ? -2.5 : 3"
          :disabled="!cleanName || !hasRoom(t)"
          @click="joinLate(ti)"
        >
          {{ hasRoom(t) ? `join ${t.name}` : `${t.name} is full` }}
          <span class="jd-count">{{ t.userIds.length }}/{{ maxTeamSize }}</span>
        </Btn>
      </div>
      <Btn v-else :disabled="!cleanName">join the smaller team</Btn>
    </form>
    <div>
      <a href="#" class="spectate-link" @click.prevent="$emit('spectate-game')">join as spectator</a>
    </div>
  </div>
</template>
