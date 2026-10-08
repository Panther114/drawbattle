<script setup>
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  C,
  FINAL_PRE_START_SEC,
  FINAL_START_COUNTDOWN_SEC,
  FinalRoundStage,
  JoinStatus,
  RoundStage,
  S,
  Sound,
  UserPresence,
  UserStatus,
  bothGuessedTime,
  drawingStartTime,
  finalRoundWinner,
  guessMatches,
  isGameEnded,
  isIOS,
  isUnavailableJoinStatus,
  applyRules,
  rules,
  findCorrectGuess,
  roundWinner,
  totalScores,
} from '../shared.js';
import { API } from '../wordpacks.js';
import { track } from '../analytics.js';
import { nav, takePreviousGameUserName } from '../nav.js';
import { playSound } from '../audio.js';
import { ReconnectingSocket } from '../socket.js';
import { safeStorage } from '../storage.js';
import { recordGame, recordRound } from '../stats.js';
import { buildFacts, creditFor, recordMatch, score } from '../rating.js';
import { presence, trackPresence } from '../presence.js';
import { qs, toggleQuick } from '../quickswitch.js';
import Icon from '../components/Icon.vue';
import AudioPreloader from '../components/AudioPreloader.vue';
import GameFinalRound from '../components/GameFinalRound.vue';
import GameChat from '../components/GameChat.vue';
import GameJoinAsDisconnectedUser from '../components/GameJoinAsDisconnectedUser.vue';
import GameLobby from '../components/GameLobby.vue';
import GameToasts from '../components/GameToasts.vue';
import GameRound from '../components/GameRound.vue';
import GameScore from '../components/GameScore.vue';
import GameSummary from '../components/GameSummary.vue';
import SoundToggle from '../components/SoundToggle.vue';
import SpectatorGameFinalRound from '../components/SpectatorGameFinalRound.vue';
import SpectatorGameRound from '../components/SpectatorGameRound.vue';
import ThemeToggle from '../components/ThemeToggle.vue';

const props = defineProps({
  gameId: { type: String, required: true },
  summaryUrl: String,
  connectedUsername: String,
  spectateOnLoad: { type: Boolean, default: false },
});

const router = useRouter();
const gameId = computed(() => props.gameId.toLowerCase());
const previousGameUserName = takePreviousGameUserName();

// connection lifecycle
const Conn = {
  Disconnected: 0,
  ConnectingFromLobby: 1,
  ConnectingAsDisconnectedUser: 2,
  ConnectingAsSpectator: 3,
  AutoConnectingAsExistingUser: 4,
  AutoConnectingAsDebug: 5,
  AutoConnectingFromEndedGame: 6,
  Reconnecting: 7,
  Connected: 8,
};

const isSpectator = ref(false);
const local = safeStorage('local');
const session = safeStorage('session');
let socket;
const connStatus = ref(Conn.Disconnected);
const game = ref();
const readyUserIds = ref({}); // round index -> Set of user ids

// a user id is stable for the browser tab
let storedId = session?.getItem('userId');
if (storedId == null || storedId.length > 16) {
  storedId = Math.random().toString(36).slice(2).padEnd(12, '0');
  session?.setItem('userId', storedId);
}
const userId = ref(storedId);

const startCountdown = ref(); // seconds until round 0 starts (lobby countdown)
const roundStage = ref();
const roundSecondsRemaining = ref(0);
const finalStage = ref();
const tick = ref(Date.now());
const showBackToLobby = ref(false);
const soundsEnabled = ref(local?.getItem('soundsEnabled') !== '0');
const roundRef = ref();
const finalRef = ref();
const clockOffset = ref(0); // Date.now() - serverNow
let tickTimer;
let pingTimer;
let wasLive = false; // true once this tab has been connected to the game as part of the session (for local stats)

const currentRound = computed(() => game.value?.currentRound);
const finalRound = computed(() => game.value?.finalRound);
const teamIndex = computed(() => {
  const teams = game.value?.teams;
  return teams ? teams.findIndex((t) => t.userIds.includes(userId.value)) : -1;
});
const isGameOver = computed(() => finalStage.value?.stage === FinalRoundStage.SummaryScreen || game.value?.ended === true);
provide('isGameOver', isGameOver);

// per-game rules follow the game's settings (they can only change in the lobby)
watch(
  () => game.value?.settings,
  (st) => applyRules(st),
  { immediate: true, deep: true },
);
watch(
  () => soundsEnabled.value,
  (v) => local?.setItem('soundsEnabled', v ? '1' : '0'),
  { immediate: true },
);
watch([currentRound, finalRound, teamIndex], () => {
  tick.value = Date.now();
});

function audioCue(kind) {
  if (soundsEnabled.value && !isIOS()) void playSound(kind);
}

// ---- stage clocks ----
function computeRoundStage(round, now, settings) {
  if (round.wordChosenTime === undefined) return [RoundStage.ChooseWord, Math.ceil(rules.chooseWordSec - (now - round.startTime) / 1000)];
  if (now - round.wordChosenTime < 1000 * rules.drawingCountdownSec) {
    return [RoundStage.DrawingCountdown, Math.ceil(rules.drawingCountdownSec - (now - round.wordChosenTime) / 1000)];
  }
  let drawStart = round.wordChosenTime + 1000 * rules.drawingCountdownSec;
  if (round.chooserHeadStartSeconds > 0) {
    drawStart += 1000 * round.chooserHeadStartSeconds;
    if (now < drawStart) return [RoundStage.DrawingHeadStart, Math.ceil((drawStart - now) / 1000)];
  }
  const both = bothGuessedTime(round);
  const end = both !== undefined ? both : drawStart + 1000 * settings.roundLengthSec;
  if (both === undefined && now < end) return [RoundStage.Drawing, Math.ceil((end - now) / 1000)];
  if (now < end + 1000 * rules.roundEndSec) return [RoundStage.DrawingEnd, Math.ceil((end + 1000 * rules.roundEndSec - now) / 1000)];
  return [RoundStage.ScoreScreen, 0];
}

function computeFinalStage(fr, now) {
  const preMs = fr.startTime + 1000 * FINAL_PRE_START_SEC - now;
  if (preMs > 0) return { stage: FinalRoundStage.PreStartCountdown, secondsRemaining: Math.ceil(preMs / 1000) };
  const countMs = fr.startTime + 1000 * (FINAL_PRE_START_SEC + FINAL_START_COUNTDOWN_SEC) - now;
  if (countMs > 0) return { stage: FinalRoundStage.StartCountdown, secondsRemaining: Math.ceil(countMs / 1000) };
  const win = finalRoundWinner(fr);
  if (win !== undefined) {
    const secs = Math.ceil((win[1] + 1000 * rules.roundEndSec - now) / 1000);
    return secs > 0 ? { stage: FinalRoundStage.RoundEnd, secondsRemaining: secs } : { stage: FinalRoundStage.SummaryScreen };
  }
  return {
    stage: FinalRoundStage.InProgress,
    areTeamsDrawing: fr.teamStates.map((states) => states[states.length - 1].startTime <= now),
  };
}

function sameFinalStage(a, b) {
  if (a.stage !== b.stage) return false;
  const timed = (s) => s === 0 || s === 1 || s === 3;
  if (timed(a.stage) && a.secondsRemaining !== b.secondsRemaining) return false;
  if (a.stage === FinalRoundStage.InProgress) {
    return a.areTeamsDrawing.length === b.areTeamsDrawing.length && !a.areTeamsDrawing.some((v, i) => v !== b.areTeamsDrawing[i]);
  }
  return true;
}

watch(tick, (nowLocal) => {
  const now = nowLocal - clockOffset.value;
  const round = currentRound.value;
  // clients assume the first word if nobody chose in time
  if (round !== undefined && round.wordChosenTime === undefined && now - round.startTime >= 1000 * rules.chooseWordSec) {
    round.word = round.wordChoices[0];
    round.wordChosenTime = round.startTime + 1000 * rules.chooseWordSec;
  }
  if (round !== undefined && game.value?.previousRounds.length === 0 && round.startTime > now) {
    startCountdown.value = Math.ceil((round.startTime - now) / 1000);
  } else {
    if (startCountdown.value !== undefined && round !== undefined && game.value !== undefined) {
      const g = game.value;
      const sizes = g.teams.map((t) => t.userIds.length);
      track('play game', {
        'game id': g.id,
        'num players': sizes.reduce((a, b) => a + b, 0),
        'team sizes': sizes,
        'num rounds': g.settings.numRounds,
        'round duration ms': 1000 * g.settings.roundLengthSec,
        'show word length': !g.settings.hideWordLength,
        'streamer mode': g.settings.streamerMode,
        'word list id': g.settings.wordListId,
        'user id': userId.value,
        username: g.users[userId.value]?.name,
      });
    }
    startCountdown.value = undefined;
  }
  if (round !== undefined) {
    const [stage, secs] = computeRoundStage(round, now, game.value.settings);
    roundStage.value = stage;
    roundSecondsRemaining.value = secs;
  }
  if (finalRound.value !== undefined) {
    const next = computeFinalStage(finalRound.value, now);
    if (finalStage.value === undefined || !sameFinalStage(finalStage.value, next)) finalStage.value = next;
  }
});

// ---- join status ----
function computeJoinStatus(g) {
  if (isGameEnded(g)) return JoinStatus.Ended;
  const started = g.fishbowlWords !== undefined || g.currentRound !== undefined || g.finalRound !== undefined;
  if (started) {
    return Object.keys(g.users).some((id) => g.users[id].status === UserStatus.Disconnected)
      ? JoinStatus.AvailableDisconnectedSpot
      : JoinStatus.Started;
  }
  return g.teams.every((t) => t.userIds.length >= 8) ? JoinStatus.Full : JoinStatus.AvailableSpot;
}
const joinStatus = computed(() => {
  if (connStatus.value !== Conn.Connected && game.value !== undefined) return computeJoinStatus(game.value);
  return undefined;
});
const isConnected = computed(() => connStatus.value === Conn.Connected);
const isAutoConnecting = computed(
  () =>
    connStatus.value === Conn.AutoConnectingAsExistingUser ||
    connStatus.value === Conn.AutoConnectingAsDebug ||
    connStatus.value === Conn.AutoConnectingFromEndedGame,
);

// ---- socket ----
function teardown() {
  socket?.disconnect();
  socket = undefined;
  if (pingTimer !== undefined) {
    clearInterval(pingTimer);
    pingTimer = undefined;
  }
}

function onMessage(e) {
  const m = JSON.parse(e.data);
  const g = game.value;
  switch (m[0]) {
    case S.SessionStart: {
      const [, snapshot, serverNow] = m;
      game.value = snapshot;
      connStatus.value = Conn.Connected;
      wasLive = true;
      clockOffset.value = Date.now() - serverNow;
      lastAwardKey = award.value?.key; // a reconnect must not pay out a guess again
      if (presence.value !== UserPresence.Active && !isSpectator.value) socket?.send(JSON.stringify([C.Presence, presence.value]));
      break;
    }
    case S.JoinGame:
      if (g !== undefined) {
        const [, user, teams] = m;
        g.users[user.id] = user;
        g.teams = teams;
      }
      break;
    case S.UserDisconnect:
      if (g !== undefined) {
        const [, id] = m;
        if (g.users[id]) {
          g.users[id].status = UserStatus.Disconnected;
          delete g.users[id].presence;
        }
        if (g.currentRound !== undefined) {
          const idx = g.previousRounds.length;
          if (readyUserIds.value[idx] !== undefined) readyUserIds.value[idx].delete(id);
        }
      }
      break;
    case S.UserLobbyDisconnect:
      if (g !== undefined) {
        const [, id, teams] = m;
        delete g.users[id];
        g.teams = teams;
      }
      break;
    case S.UserReconnect:
      if (g !== undefined) {
        const [, id] = m;
        if (g.users[id]) g.users[id].status = UserStatus.Connected;
      }
      break;
    case S.UserGuess: {
      if (g === undefined) break;
      const [, roundIdx, team, guess] = m;
      let guesses;
      let word;
      if (Array.isArray(roundIdx)) {
        const [i] = roundIdx;
        if (g.finalRound === undefined) throw new Error('received finalRound guess without finalRound');
        guesses = g.finalRound.teamStates[team][i].guesses;
        word = g.finalRound.words[i];
      } else if (g.previousRounds.length === roundIdx) {
        if (g.currentRound === undefined) throw new Error('missing currentRound');
        guesses = g.currentRound.teamStates[team].guesses;
        word = g.currentRound.word;
      } else {
        if (g.previousRounds[roundIdx] === undefined) throw new Error('missing previousRound');
        guesses = g.previousRounds[roundIdx].teamStates[team].guesses;
        word = g.previousRounds[roundIdx].word;
      }
      if (findCorrectGuess(guesses, word) === undefined && guessMatches(guess.guess, word)) {
        audioCue(team === teamIndex.value ? Sound.CorrectGuess : Sound.OtherTeamCorrectGuess);
      }
      guesses.push(guess);
      tick.value = Date.now();
      break;
    }
    case S.UpdateTeams:
      if (g !== undefined) g.teams = m[1];
      break;
    case S.StartRound: {
      const [, index, round, serverNow] = m;
      if (g !== undefined) {
        if (g.currentRound) {
          if (g.previousRounds.length !== index - 1) throw new Error('bad StartRound index');
          g.previousRounds[index - 1] = g.currentRound;
        } else if (index !== 0) throw new Error('bad StartRound index');
        g.currentRound = round;
      }
      clockOffset.value = Date.now() - serverNow;
      break;
    }
    case S.UpdateUser:
      if (g !== undefined) g.users[m[1].id] = m[1];
      break;
    case S.ReadyUp: {
      const [, idx, ids] = m;
      if (g?.currentRound === undefined) break;
      const cur = g.previousRounds.length;
      if (cur !== idx) break;
      if (readyUserIds.value[cur] !== undefined && readyUserIds.value[cur].size > ids.length) break;
      readyUserIds.value[cur] = new Set(ids);
      break;
    }
    case S.WordChosen: {
      const [, idx, word, time] = m;
      if (g === undefined) break;
      if (g.currentRound) {
        if (g.previousRounds.length !== idx) break;
        g.currentRound.word = word;
        g.currentRound.wordChosenTime = time;
      }
      break;
    }
    case S.StartFinalRound:
      if (g !== undefined) {
        g.finalRound = m[1];
        if (g.currentRound !== undefined) g.previousRounds[g.settings.numRounds - 1] = g.currentRound;
        g.currentRound = undefined;
      }
      break;
    case S.UpdateSettings:
      if (g !== undefined) g.settings = m[1];
      break;
    case S.FinalRoundNextWord:
      if (g?.finalRound) {
        const [, idx, team, state] = m;
        g.finalRound.teamStates[team][idx] = state;
        tick.value = Date.now();
      }
      break;
    case S.CancelStartGame:
      if (g !== undefined) g.currentRound = undefined;
      break;
    case S.CanvasOperation: {
      if (g === undefined || connStatus.value !== Conn.Connected) break;
      const [, roundIdx, team, op] = m;
      if (Array.isArray(roundIdx)) {
        const [i] = roundIdx;
        if (g.finalRound === undefined) throw new Error('missing finalRound');
        const states = g.finalRound.teamStates[team];
        if (i === states.length - 1 && states[i].canvasOperations === undefined) throw new Error('missing canvasOperations');
        const st = states[i];
        if (st.drawerId !== userId.value) {
          st.canvasOperations?.push(op);
          finalRef.value?.processMessage(m);
        }
      } else if (roundIdx === g.previousRounds.length) {
        if (g.currentRound === undefined) throw new Error('missing currentRound');
        const ts = g.currentRound.teamStates[team];
        if (ts.drawerId !== userId.value) {
          ts.canvasOperations.push(op);
          roundRef.value?.processMessage(m);
        }
      } else {
        if (g.previousRounds[roundIdx] === undefined) throw new Error('missing previousRound');
        const ts = g.previousRounds[roundIdx].teamStates[team];
        if (ts.drawerId !== userId.value) ts.canvasOperations?.push(op);
      }
      break;
    }
    case S.UpdateFishbowlWords:
      if (g !== undefined) g.fishbowlWords = m[1];
      break;
    case S.Presence:
      if (g !== undefined && g.users[m[1]]) {
        if (m[2]) g.users[m[1]].presence = m[2];
        else delete g.users[m[1]].presence;
      }
      break;
    case S.Chat:
      if (g !== undefined) {
        if (!g.chat) g.chat = [];
        g.chat.push(m[1]);
        if (g.chat.length > 80) g.chat.splice(0, g.chat.length - 80);
      }
      break;
    case S.KickVotes:
      if (g !== undefined) g.kickVotes = m[1];
      break;
    case S.SwitchAppeals:
      if (g !== undefined) g.switchAppeals = m[1];
      break;
    case S.UserKicked: {
      if (g === undefined) break;
      const [, id, teams, removed] = m;
      if (removed) delete g.users[id];
      else if (g.users[id]) g.users[id].status = UserStatus.Kicked;
      g.teams = teams;
      const idx = g.previousRounds.length;
      if (readyUserIds.value[idx] !== undefined) readyUserIds.value[idx].delete(id);
      break;
    }
    case S.DrawerRotated: {
      if (g === undefined) break;
      const [, where, team, drawerId, chooserId] = m;
      if (Array.isArray(where)) {
        const st = g.finalRound?.teamStates[team]?.[where[0]];
        if (st) st.drawerId = drawerId;
      } else if (g.currentRound !== undefined && where === g.previousRounds.length) {
        g.currentRound.teamStates[team].drawerId = drawerId;
        if (chooserId !== undefined) g.currentRound.chooserId = chooserId;
      }
      break;
    }
    case S.GameOver:
      // the last round was the end of the game (no final drawdown)
      if (g !== undefined && g.currentRound !== undefined) {
        g.previousRounds.push(g.currentRound);
        g.currentRound = undefined;
        g.ended = true;
        showBackToLobby.value = true;
        setTimeout(() => {
          if (socket !== undefined) {
            teardown();
            connStatus.value = Conn.Disconnected;
          }
        }, 1500);
      }
      break;
    case S.ServerError:
      if (m[1].type === 'Closed') {
        teardown();
        nav.joinError = { status: JoinStatus.Closed, gameId: gameId.value, reason: m[1].reason };
        router.replace({ name: 'Home' });
      } else if (m[1].type === 'Kicked') {
        teardown();
        nav.joinError = { status: JoinStatus.Kicked, gameId: gameId.value };
        router.replace({ name: 'Home' });
      } else if (m[1].type === 'GameNotFound') {
        teardown();
        nav.joinError = { status: JoinStatus.Nonexistent, gameId: m[1].gameId };
        router.replace({ name: 'Home' });
      }
      break;
    case S.ForceRefresh:
      location.reload();
      break;
  }
}

function connect(status, name) {
  if (socket !== undefined) return;
  connStatus.value = status;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const q = new URLSearchParams({ gameId: gameId.value, userId: userId.value });
  if (name !== undefined) q.set('userName', name);
  q.set('rating', String(score.rating)); // my own score, kept on this device
  if (isSpectator.value) q.set('spectate', 'true');
  socket = new ReconnectingSocket({ url: `${proto}//${window.location.host}/ws/?${q}`, onMessage });
  if (pingTimer !== undefined) clearInterval(pingTimer);
  pingTimer = window.setInterval(() => {
    if (socket !== undefined) socket.send('_');
    else {
      clearInterval(pingTimer);
      pingTimer = undefined;
    }
  }, 15000);
  if (isSpectator.value) track('connect game socket', { 'game id': gameId.value, spectate: true });
  else track('connect game socket', { 'game id': gameId.value, 'user id': userId.value, username: name });
}

function send(msg) {
  socket?.send(JSON.stringify(msg));
  if (msg[0] === C.UserGuess) {
    const [, round, guess] = msg;
    if (!Array.isArray(round) && clockOffset.value !== undefined) {
      // report guesses that never made it to the server
      setTimeout(() => {
        const g = game.value;
        if (g === undefined) return;
        const r = round < g.previousRounds.length ? g.previousRounds[round] : g.currentRound;
        if (r === undefined || r.teamStates[teamIndex.value].guesses.some((x) => x.userId === userId.value && x.guess === guess)) return;
        track('error - dropped guess', { 'game id': gameId.value, 'user id': userId.value, 'round index': round, guess });
      }, 5000);
    }
  }
}

// local drawing operations are applied optimistically, then sent
function sendCanvasOp(op) {
  const g = game.value;
  if (g?.finalRound) {
    const states = g.finalRound.teamStates[teamIndex.value];
    const idx = states.length - 1;
    socket?.send(JSON.stringify([C.CanvasOperation, [idx], op]));
    states[idx].canvasOperations?.push(op);
  } else if (g?.currentRound !== undefined) {
    socket?.send(JSON.stringify([C.CanvasOperation, g.previousRounds.length, op]));
    g.currentRound.teamStates[teamIndex.value].canvasOperations?.push(op);
  }
}

async function fetchGame(include) {
  const res = await fetch(`${API}/games/${gameId.value}?include=${include}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 200) return res.json();
  return undefined;
}
async function fetchFullGame() {
  const full = await fetchGame('all');
  if (full !== undefined) game.value = full;
}

// ---- join/spectate handlers from lobby ----
const joinGame = (name) => connect(Conn.ConnectingFromLobby, name);
const spectate = () => {
  isSpectator.value = true;
  connect(Conn.ConnectingAsSpectator);
};
const rejoinAs = (id) => {
  userId.value = id;
  session?.setItem('userId', id);
  connect(Conn.ConnectingAsDisconnectedUser);
};

watch(joinStatus, (s) => {
  if (s === undefined) return;
  if (s === JoinStatus.Full || s === JoinStatus.Started) {
    isSpectator.value = true;
    connect(Conn.ConnectingAsSpectator);
  } else if (isUnavailableJoinStatus(s)) {
    if (joinStatus.value === JoinStatus.AvailableSpot && socket === undefined && previousGameUserName !== undefined) {
      connect(Conn.AutoConnectingFromEndedGame, previousGameUserName);
    }
  } else {
    nav.joinError = { status: s, gameId: gameId.value };
    router.replace({ name: 'Home' });
  }
});

// ---- personal stats (kept in this browser only) ----
const gameKey = computed(() => (game.value ? `${game.value.id}-${game.value.createdAt ?? 0}` : undefined));
const isPlayer = computed(() => wasLive && !isSpectator.value && teamIndex.value >= 0);
watch(roundStage, (stage) => {
  const r = currentRound.value;
  if (stage !== RoundStage.ScoreScreen || r === undefined || !isPlayer.value || r.word === undefined) return;
  const ti = teamIndex.value;
  recordRound(gameKey.value, game.value.previousRounds.length, r.teamStates[ti].drawerId === userId.value ? 'd' : 'g', roundWinner(r) === ti);
});
function recordFinish() {
  const g = game.value;
  if (g === undefined || !isPlayer.value || g.previousRounds.length === 0) return;
  const totals = totalScores(g.previousRounds, g.finalRound);
  const mine = totals[teamIndex.value];
  const theirs = totals[1 - teamIndex.value];
  recordGame(gameKey.value, mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw', mine, theirs);
  recordMatch(buildFacts(g, gameKey.value), userId.value);
}

// ---- my score: points show up as they are earned (the final table at the end shares out the pot) ----
const toasts = ref([]);
let toastSeq = 0;
let lastAwardKey;
const award = computed(() => {
  const r = currentRound.value;
  const g = game.value;
  const ti = teamIndex.value;
  if (!r || !g || r.word === undefined || ti < 0 || isSpectator.value || !wasLive) return undefined;
  const mine = findCorrectGuess(r.teamStates[ti].guesses, r.word);
  if (!mine) return undefined;
  const drawing = r.teamStates[ti].drawerId === userId.value;
  if (!drawing && mine.userId !== userId.value) return undefined;
  const other = findCorrectGuess(r.teamStates[1 - ti].guesses, r.word);
  const rank = other && other.timestamp < mine.timestamp ? 2 : 1;
  const s = 1 - (mine.timestamp - drawingStartTime(r, ti)) / 1000 / Math.max(1, g.settings.roundLengthSec);
  return { key: g.previousRounds.length, drawing, rank, pts: Math.round(creditFor(rank, s)) };
});
watch(award, (a) => {
  if (!a || a.key === lastAwardKey) return;
  lastAwardKey = a.key;
  const id = ++toastSeq;
  const text = a.drawing ? 'your team guessed your drawing' : 'you guessed it';
  toasts.value.push({ id, pts: a.pts, second: a.rank === 2, text: a.rank === 2 ? `${text} (second)` : text });
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, 3200);
});
// tell the others when I switch windows / open Quick Switch
watch(presence, (p) => {
  if (!isSpectator.value && connStatus.value === Conn.Connected) socket?.send(JSON.stringify([C.Presence, p]));
});

watch(finalStage, (s) => {
  if (s?.stage !== undefined && s.stage !== FinalRoundStage.SummaryScreen) showBackToLobby.value = true;
  if (s?.stage === FinalRoundStage.SummaryScreen && socket !== undefined) {
    // the game is over; let go of the socket shortly after the summary shows
    setTimeout(() => {
      if (socket !== undefined) {
        teardown();
        connStatus.value = Conn.Disconnected;
      }
    }, 1000);
  }
});

onMounted(async () => {
  trackPresence();
  if (props.summaryUrl !== undefined) {
    const res = await fetch(props.summaryUrl);
    game.value = await res.json();
    return;
  }
  const g = await fetchGame('guesses');
  if (g !== undefined) {
    game.value = g;
    if (!isGameEnded(g) && socket === undefined && g.users[userId.value] != null) connect(Conn.AutoConnectingAsExistingUser);
    else if (props.spectateOnLoad && !isGameEnded(g) && socket === undefined) spectate();
  } else {
    nav.joinError = { status: JoinStatus.Nonexistent, gameId: gameId.value };
    router.replace({ name: 'Home' });
  }
  tickTimer = window.setInterval(() => {
    tick.value = Date.now();
  }, 100);
});
onUnmounted(() => {
  teardown();
  if (tickTimer !== undefined) clearInterval(tickTimer);
});

// what to show
const view = computed(() => {
  const g = game.value;
  if (g === undefined || (joinStatus.value !== undefined && !isUnavailableJoinStatus(joinStatus.value)) || isAutoConnecting.value) {
    return 'empty';
  }
  if (finalStage.value?.stage === FinalRoundStage.SummaryScreen || g.ended === true) return 'summary';
  if (!isSpectator.value && joinStatus.value === JoinStatus.AvailableDisconnectedSpot) return 'rejoin';
  if ((currentRound.value === undefined && finalRound.value === undefined) || startCountdown.value !== undefined) return 'lobby';
  if (connStatus.value !== Conn.Connected) return 'empty';
  if (finalRound.value !== undefined) {
    if (finalStage.value === undefined) return 'empty';
    return isSpectator.value ? 'finalSpectator' : 'final';
  }
  if (roundStage.value === RoundStage.ScoreScreen) return 'score';
  return isSpectator.value ? 'roundSpectator' : 'round';
});

watch(view, (v) => {
  if (v === 'summary') recordFinish();
});
</script>

<template>
  <div class="game-root">
    <div v-if="isSpectator" class="spectating-info">you're spectating</div>
    <div class="game-info">
      <div v-if="game && game.connectedAppInfo === undefined" class="game-info-row">
        <span>game {{ game.settings.streamerMode ? '****' : gameId.toUpperCase() }}</span>
        <router-link v-tooltip="'leave game'" to="/" class="leave-link" />
      </div>
      <div class="game-info-row">
        <template v-if="!isIOS()">
          <span>sounds</span>
          <SoundToggle class="sound-toggle-pos" :enabled="soundsEnabled" @toggle="soundsEnabled = !soundsEnabled" />
        </template>
        <ThemeToggle class="sound-toggle-pos" />
        <button v-if="qs.enabled" v-tooltip="'quick switch'" class="qs-trigger" aria-label="quick switch" @click="toggleQuick"><Icon name="bolt" /></button>
      </div>
    </div>

    <Transition name="view" mode="out-in">
    <div v-if="view === 'empty'" />
    <GameSummary
      v-else-if="view === 'summary'"
      :game="game"
      :show-back-to-lobby="showBackToLobby"
      :user-id="userId"
      :fetch-full-game="fetchFullGame"
      @audio-cue="audioCue"
    />
    <GameJoinAsDisconnectedUser
      v-else-if="view === 'rejoin'"
      :users="game.users"
      @join-game="rejoinAs"
      @spectate-game="spectate"
    />
    <GameLobby
      v-else-if="view === 'lobby'"
      :is-connected="isConnected"
      :game-id="gameId"
      :user-id="userId"
      :is-spectator="isSpectator"
      :users="game.users"
      :teams="game.teams"
      :fishbowl-words="game.fishbowlWords"
      :connected-app="game.connectedAppInfo?.app"
      :game-settings="game.settings"
      :start-game-seconds-remaining="startCountdown"
      :init-user-name="connectedUsername || previousGameUserName"
      @client-message="send"
      @audio-cue="audioCue"
      @join-game="joinGame"
      @spectate-game="spectate"
    />
    <SpectatorGameFinalRound
      v-else-if="view === 'finalSpectator'"
      ref="finalRef"
      :final-round="finalRound"
      :final-round-stage-with-context="finalStage"
      :users="game.users"
      :teams="game.teams"
      @audio-cue="audioCue"
    />
    <GameFinalRound
      v-else-if="view === 'final'"
      ref="finalRef"
      :user-id="userId"
      :team-index="teamIndex"
      :final-round="finalRound"
      :final-round-stage-with-context="finalStage"
      :users="game.users"
      :teams="game.teams"
      @client-message="send"
      @canvas-operation="sendCanvasOp"
      @audio-cue="audioCue"
    />
    <GameScore
      v-else-if="view === 'score'"
      :game-id="gameId"
      :round-index="game.previousRounds.length"
      :round="currentRound"
      :ready-user-ids="readyUserIds[game.previousRounds.length]"
      :previous-rounds="game.previousRounds"
      :users="game.users"
      :teams="game.teams"
      :current-user-id="userId"
      :is-spectator="isSpectator"
      :game-settings="game.settings"
      @client-message="send"
      @audio-cue="audioCue"
    />
    <SpectatorGameRound
      v-else-if="view === 'roundSpectator'"
      ref="roundRef"
      :round-index="game.previousRounds.length"
      :round="currentRound"
      :round-stage="roundStage"
      :round-stage-seconds-remaining="roundSecondsRemaining"
      :previous-rounds="game.previousRounds"
      :users="game.users"
      :teams="game.teams"
      :game-settings="game.settings"
      @audio-cue="audioCue"
    />
    <GameRound
      v-else-if="view === 'round'"
      ref="roundRef"
      :user-id="userId"
      :team-index="teamIndex"
      :round-index="game.previousRounds.length"
      :round="currentRound"
      :round-stage="roundStage"
      :round-stage-seconds-remaining="roundSecondsRemaining"
      :previous-rounds="game.previousRounds"
      :users="game.users"
      :teams="game.teams"
      :game-settings="game.settings"
      @client-message="send"
      @canvas-operation="sendCanvasOp"
      @audio-cue="audioCue"
    />
    </Transition>
    <GameChat
      v-if="game && isConnected && view !== 'empty'"
      :game="game"
      :user-id="userId"
      :is-spectator="isSpectator"
      :between-rounds="view === 'score'"
      @client-message="send"
    />
    <GameToasts :items="toasts" />
    <AudioPreloader v-if="!isIOS()" />
  </div>
</template>
