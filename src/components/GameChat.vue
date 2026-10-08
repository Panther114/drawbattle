<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { C, MAX_CHAT_LENGTH, UserStatus, rules, voteThreshold } from '../shared.js';
import { safeStorage } from '../storage.js';
import Icon from './Icon.vue';

const props = defineProps({
  game: { type: Object, required: true },
  userId: { type: String, required: true },
  isSpectator: { type: Boolean, default: false },
  betweenRounds: { type: Boolean, default: false },
});
const emit = defineEmits(['client-message']);

const storage = safeStorage('local');
const saved = storage?.getItem('chatOpen');
// open by default on roomy screens, tucked away on phones
const open = ref(saved != null ? saved === '1' : window.matchMedia?.('(min-width: 900px)').matches ?? false);
const tab = ref('chat');
const text = ref('');
const unread = ref(0);
const list = ref();
const input = ref();
let pinned = true; // keep the newest message in view unless the reader scrolled up

const messages = computed(() => props.game.chat ?? []);
const users = computed(() => props.game.users);
const teams = computed(() => props.game.teams);

function setOpen(v) {
  open.value = v;
  storage?.setItem('chatOpen', v ? '1' : '0');
  if (v) {
    if (tab.value === 'chat') unread.value = 0;
    pinned = true;
    nextTick(() => {
      scrollDown();
      if (tab.value === 'chat') input.value?.focus();
    });
  }
}
function setTab(t) {
  tab.value = t;
  if (t === 'chat') {
    unread.value = 0;
    pinned = true;
    nextTick(scrollDown);
  }
}
function scrollDown() {
  if (list.value) list.value.scrollTop = list.value.scrollHeight;
}
function onScroll() {
  const el = list.value;
  pinned = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 24;
}

watch(
  () => messages.value.at(-1)?.id,
  (id) => {
    if (id === undefined) return;
    const m = messages.value.at(-1);
    if (!open.value || tab.value !== 'chat') {
      if (m.userId !== props.userId) unread.value += 1;
    }
    if (pinned) nextTick(scrollDown);
  },
);
onMounted(scrollDown);

function send() {
  const t = text.value.trim();
  if (!t || props.isSpectator) return;
  emit('client-message', [C.Chat, t.slice(0, MAX_CHAT_LENGTH)]);
  text.value = '';
  pinned = true;
}

const teamOf = (id) => teams.value.findIndex((t) => t.userIds.includes(id));
const nameOf = (m) => users.value[m.userId]?.name || m.name || 'anonymous';
const teamClass = (m) => `t${teamOf(m.userId) >= 0 ? teamOf(m.userId) : (m.team ?? 0)}`;

// ---- players tab: vote kick and team switch requests ----
const me = computed(() => users.value[props.userId]);
const myTeam = computed(() => teamOf(props.userId));
const active = computed(() =>
  teams.value.flatMap((t) => t.userIds).filter((id) => users.value[id]?.status === UserStatus.Connected),
);
const canVote = computed(() => !props.isSpectator && myTeam.value >= 0 && me.value?.status === UserStatus.Connected);

function tally(votes, aboutId) {
  const voters = active.value.filter((v) => v !== aboutId);
  const set = new Set(votes ?? []);
  return {
    yes: voters.filter((v) => set.has(v)).length,
    needed: voteThreshold(voters.length),
    mine: set.has(props.userId),
  };
}
function kickInfo(id) {
  const t = tally(props.game.kickVotes?.[id], id);
  const ti = teamOf(id);
  const enough = randomLobby.value ? teams.value.reduce((n, t) => n + t.userIds.length, 0) > 4 : ti >= 0 && teams.value[ti].userIds.length >= 3;
  const possible = canVote.value && id !== props.userId && active.value.length >= 3 && ti >= 0 && enough;
  return { ...t, possible };
}
const kick = (id) => emit('client-message', [C.VoteKick, id]);

// random teams: until the game starts everyone is listed together (the real teams are drawn at the start)
const gameStarted = computed(() => props.game.currentRound !== undefined || props.game.finalRound !== undefined || props.game.ended === true);
const randomLobby = computed(() => props.game.settings?.randomTeams === true && !gameStarted.value);
const noSwitching = computed(() => props.game.settings?.randomTeams === true);
const groups = computed(() => {
  const list = teams.value.map((t, ti) => ({
    ti,
    name: t.name,
    members: t.userIds.map((id) => ({ id, user: users.value[id] })).filter((m) => m.user),
  }));
  if (!randomLobby.value) return list;
  return [{ ti: 0, name: 'random teams', members: list.flatMap((g) => g.members) }];
});
const online = (user) => user.status === UserStatus.Connected;

const myAppeal = computed(() => !!props.game.switchAppeals?.[props.userId]);
const canAppeal = computed(() => {
  if (!props.betweenRounds || !canVote.value || myTeam.value < 0) return false;
  const mates = teams.value[myTeam.value].userIds.filter((id) => users.value[id]?.status === UserStatus.Connected);
  const other = teams.value[1 - myTeam.value];
  return mates.length > 2 && other.userIds.length < rules.maxTeamSize && active.value.length - 1 >= 2;
});
const appeals = computed(() =>
  Object.entries(props.game.switchAppeals ?? {})
    .filter(([id]) => teamOf(id) >= 0 && users.value[id])
    .map(([id, votes]) => ({
      id,
      name: users.value[id].name || 'anonymous',
      to: teams.value[1 - teamOf(id)].name,
      ...tally(votes, id),
    })),
);
const appeal = () => emit('client-message', [C.SwitchAppeal]);
const voteSwitch = (id) => emit('client-message', [C.SwitchVote, id]);
// a dot on the tab while a request is waiting for my answer
const needsMe = computed(() => canVote.value && appeals.value.some((a) => a.id !== props.userId && !a.mine));
</script>

<template>
  <aside class="gc" :class="{ closed: !open }" aria-label="game chat">
    <Transition name="gc-swap" mode="out-in">
    <button v-if="!open" key="pill" type="button" class="gc-pill" @click="setOpen(true)">
      <Icon name="chat" class="gc-pill-icon" />
      chat
      <span v-if="unread > 0" :key="unread" class="gc-badge">{{ unread > 9 ? '9+' : unread }}</span>
    </button>

    <section v-else key="panel" class="gc-panel">
      <header class="gc-head">
        <div class="gc-tabs" role="tablist">
          <button type="button" role="tab" :aria-selected="tab === 'chat'" :class="{ on: tab === 'chat' }" @click="setTab('chat')">
            <Icon name="chat" class="gc-tab-ic c-blue" />chat
            <span v-if="unread > 0 && tab !== 'chat'" class="gc-badge">{{ unread > 9 ? '9+' : unread }}</span>
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="tab === 'players'"
            :class="{ on: tab === 'players' }"
            @click="setTab('players')"
          >
            <Icon name="people" class="gc-tab-ic c-purple" />players <span class="gc-count">{{ active.length }}</span>
            <span v-if="needsMe" class="gc-dot" title="a team switch request needs your vote" />
          </button>
        </div>
        <button type="button" class="gc-min" aria-label="minimize chat" title="minimize" @click="setOpen(false)">
          <span />
        </button>
      </header>

      <div v-show="tab === 'chat'" class="gc-chat">
        <div ref="list" class="gc-list" aria-live="polite" @scroll="onScroll">
          <div v-if="messages.length === 0" class="gc-empty">nobody has said anything yet</div>
          <template v-for="m in messages" :key="m.id">
            <div v-if="m.sys" class="gc-sys">{{ m.text }}</div>
            <div v-else class="gc-msg" :class="{ mine: m.userId === userId }">
              <span class="gc-name" :class="teamClass(m)">{{ nameOf(m) }}</span>
              <span class="gc-text">{{ m.text }}</span>
            </div>
          </template>
        </div>
        <form class="gc-form" @submit.prevent="send">
          <input
            ref="input"
            v-model="text"
            type="text"
            class="gc-input"
            :maxlength="MAX_CHAT_LENGTH"
            :placeholder="isSpectator ? 'spectators can only read' : 'say something...'"
            :disabled="isSpectator"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            aria-label="chat message"
          />
          <button type="submit" class="gc-send" :disabled="isSpectator || text.trim() === ''" aria-label="send message">
            <Icon name="send" />
          </button>
        </form>
      </div>

      <div v-show="tab === 'players'" class="gc-players">
        <div v-for="g in groups" :key="g.ti" class="gp-team">
          <div class="gp-team-title" :class="'t' + g.ti">
            {{ g.name }} <span>{{ g.members.length }}</span>
          </div>
          <div v-for="m in g.members" :key="m.id" class="gp-row" :class="{ off: !online(m.user) }">
            <span class="gp-name">
              {{ m.user.name || 'anonymous' }}<em v-if="m.id === userId"> (you)</em><sup v-if="m.user.rating !== undefined" class="rating">{{ m.user.rating }}</sup>
              <span v-if="!online(m.user)" class="gp-off">offline</span>
            </span>
            <button
              v-if="kickInfo(m.id).possible"
              type="button"
              class="gp-kick"
              :class="{ mine: kickInfo(m.id).mine, hot: kickInfo(m.id).yes > 0 }"
              :title="
                kickInfo(m.id).mine
                  ? 'click to take back your vote'
                  : `vote to kick ${m.user.name || 'anonymous'} (${kickInfo(m.id).needed} votes needed)`
              "
              @click="kick(m.id)"
            >
              <Icon name="ban" />{{ kickInfo(m.id).yes > 0 || kickInfo(m.id).mine ? `kick ${kickInfo(m.id).yes}/${kickInfo(m.id).needed}` : 'votekick' }}
            </button>
          </div>
        </div>

        <div v-if="!isSpectator && !noSwitching" class="gp-switch">
          <div class="gp-section-title"><Icon name="swap" class="gp-sec-ic" />switch teams</div>
          <template v-if="betweenRounds">
            <button v-if="canAppeal || myAppeal" type="button" class="gp-appeal" @click="appeal">
              <Icon name="swap" />{{ myAppeal ? 'withdraw my request' : 'ask to switch teams' }}
            </button>
            <div v-else class="gp-hint">you need 3+ players on your team to ask</div>
            <div v-for="a in appeals" :key="a.id" class="gp-appeal-row">
              <span class="gp-appeal-text"
                ><b>{{ a.id === userId ? 'you' : a.name }}</b> want{{ a.id === userId ? '' : 's' }} to join {{ a.to }}</span
              >
              <button
                v-if="a.id !== userId && canVote"
                type="button"
                class="gp-kick"
                :class="{ mine: a.mine, hot: a.yes > 0 }"
                @click="voteSwitch(a.id)"
              >
                <Icon name="check" />{{ a.mine ? 'agreed' : 'agree' }} {{ a.yes }}/{{ a.needed }}
              </button>
              <span v-else class="gp-tally">{{ a.yes }}/{{ a.needed }}</span>
            </div>
          </template>
          <div v-else class="gp-hint">you can ask between rounds</div>
        </div>
        <div class="gp-hint gp-foot">a vote needs more than half of the other active players</div>
      </div>
    </section>
    </Transition>
  </aside>
</template>
