import { getWords, wordListExists, getWordListMeta, DEFAULT_WORD_LIST_ID } from './wordpacks.js';

// message types sent by the server
export const S = {
  SessionStart: 1,
  JoinGame: 2,
  UserGuess: 3,
  UpdateTeams: 4,
  StartRound: 5,
  UpdateUser: 6,
  ReadyUp: 7,
  WordChosen: 8,
  UserLobbyDisconnect: 10,
  UserDisconnect: 11,
  UserReconnect: 12,
  UpdateSettings: 14,
  StartFinalRound: 15,
  FinalRoundNextWord: 16,
  CancelStartGame: 17,
  CanvasOperation: 18,
  UpdateFishbowlWords: 19,
  Chat: 20,
  KickVotes: 21,
  UserKicked: 22,
  DrawerRotated: 23,
  SwitchAppeals: 24,
  GameOver: 25,
  Presence: 26,
  GameEnded: 27,
  EndVotes: 28,
  ServerError: 300,
  ForceRefresh: 301,
};

// message types sent by the client
export const C = {
  UserGuess: 101,
  StartGame: 102,
  CancelStartGame: 103,
  JoinTeam: 104,
  UpdateUserName: 105,
  UpdateSettings: 106,
  ChooseWord: 107,
  ReadyUp: 108,
  CanvasOperation: 109,
  SubmitFishbowlWords: 110,
  ForceStartNextRound: 111,
  Chat: 112,
  VoteKick: 113,
  SwitchAppeal: 114,
  SwitchVote: 115,
  Presence: 116,
  VoteEnd: 117,
};

export const Status = { Connected: 1, Disconnected: 2, Kicked: 3 };

// timing constants (seconds) shared with the client
export const DEFAULT_RULES = {
  chooseWordSec: 15,
  wordChoiceCount: 2,
  startCountdownSec: 5,
  drawingCountdownSec: 3,
  roundEndSec: 5,
  headStart: true,
  headStartBase: 3,
  headStartStep: 1,
  finalWordDelaySec: 2,
  fuzzyMatch: false,
  maxTeamSize: 8,
  alwaysRotate: false,
  allowSpectators: true,
  allowLateJoin: true,
  lateJoinPickTeam: false,
  singleWordsOnly: false,
  maxWordLength: 0,
  finalDrawdown: true,
};
// clamp numeric rules to sane ranges so a bad client cannot wedge a game
const RULE_RANGES = {
  chooseWordSec: [3, 120],
  wordChoiceCount: [2, 4],
  startCountdownSec: [3, 20],
  drawingCountdownSec: [1, 15],
  roundEndSec: [2, 20],
  headStartBase: [0, 30],
  headStartStep: [0, 10],
  finalWordDelaySec: [1, 10],
  maxTeamSize: [2, 8],
  maxWordLength: [0, 40],
};
export const SETTING_RANGES = { numRounds: [1, 200], roundLengthSec: [5, 600] };
export const START_COUNTDOWN_SEC = 5;
export const CHOOSE_WORD_SEC = 15;
export const DRAWING_COUNTDOWN_SEC = 3;
export const DRAWING_END_SEC = 5;
export const FINAL_PRE_START_SEC = 11;
export const FINAL_START_COUNTDOWN_SEC = 3;
export const FINAL_NEXT_WORD_DELAY_MS = 2000;
export const HEAD_START_BASE_SEC = 3;
export const HEAD_START_STEP_SEC = 1;
export const MAX_TEAM_SIZE = 8;
export const MAX_GUESS_LENGTH = 36;
export const MAX_NAME_LENGTH = 16;
export const MAX_CHAT_LENGTH = 140;
const CHAT_HISTORY = 80;
const CHAT_BURST = 5; // messages allowed per CHAT_WINDOW_MS per player
const CHAT_WINDOW_MS = 8000;
const MIN_VOTE_PLAYERS = 3; // a vote kick needs at least this many active players
const MIN_RANDOM_PLAYERS = 4; // random teams need 2 + 2
const READY_COOLDOWN_MS = 1000;
const PRESENCE_BURST = 8; // presence changes allowed per PRESENCE_WINDOW_MS per player
const PRESENCE_WINDOW_MS = 10000;
const MAX_RATING = 99999;
export const EMPTY_END_MS = 15 * 1000; // a started game nobody is connected to for this long is ended and scored

// the score a client reports about itself (it is stored on the player's own device); anything odd counts as 0
export function sanitizeRating(raw) {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.max(-MAX_RATING, Math.min(MAX_RATING, n)) : 0;
}

// strictly more than half
export const voteThreshold = (voters) => Math.floor(voters / 2) + 1;

// usernames: no control / invisible characters, no "(you)" look-alikes, capped length
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
const YOU_TAG = /\(\s*y\s*o\s*u\s*\)/gi;
export function sanitizeName(raw) {
  if (typeof raw !== 'string') return '';
  let n = raw.normalize('NFKC').replace(INVISIBLE, '');
  for (let prev = ''; prev !== n; ) {
    prev = n;
    n = n.replace(YOU_TAG, '');
  }
  return Array.from(n.replace(/\s+/g, ' ').trim()).slice(0, MAX_NAME_LENGTH).join('').trim();
}

// ---- game lifetime ----
export const IDLE_MS = 10 * 60 * 1000; // no activity at all (messages, drawing, chat) for this long: the game is deleted
export const EMPTY_MS = 2 * 60 * 1000; // an unstarted game nobody is connected to is deleted after this long
export const LIVE_IDLE_MS = 30 * 60 * 1000; // players are still connected (heartbeat-checked) but nothing happens at all

// a started game whose players all dropped keeps its seats for IDLE_MS so they can come back
export function isStale(g, now) {
  const idle = now - g.lastActivity;
  if (g.activeCount > 0) return idle > LIVE_IDLE_MS;
  return idle > (g.started ? IDLE_MS : EMPTY_MS);
}

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz';

export function randomGameId(exists) {
  for (;;) {
    let id = '';
    for (let i = 0; i < 4; i++) id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
    if (!exists(id)) return id;
  }
}

// ---- guess matching (identical to the client) ----
function stripAccents(s) {
  return /[가-힯]/.test(s) ? s : s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
export function normalizeGuess(s) {
  return stripAccents(s)
    .toLowerCase()
    .replace(/[^\w一-鿿㐀-䶿가-힯ß]/g, '');
}
function withinOneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else {
      if (++edits > 1) return false;
      if (a.length > b.length) i++;
      else if (a.length < b.length) j++;
      else {
        i++;
        j++;
      }
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
export function guessMatches(guess, word, fuzzy = false) {
  if (!word) return false;
  const g = normalizeGuess(guess);
  const w = normalizeGuess(word);
  if (g === w) return true;
  return fuzzy && w.length >= 6 && g.length > 0 && withinOneEdit(g, w);
}
export function findCorrectGuess(guesses, word, fuzzy = false) {
  for (const g of guesses) if (guessMatches(g.guess, word, fuzzy)) return g;
  return undefined;
}

// team index whose first correct guess came earliest
export function roundWinner(round, fuzzy = false) {
  let best;
  let bestTeam;
  round.teamStates.forEach((ts, i) => {
    const g = findCorrectGuess(ts.guesses, round.word, fuzzy);
    if (g && (best === undefined || g.timestamp < best.timestamp)) {
      best = g;
      bestTeam = i;
    }
  });
  return bestTeam;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const Op = { ChangeColor: 204, ClearCanvas: 205, ChangeTool: 206, ChangeStrokeWidth: 207 };

const mapOfSets = (m) => Object.fromEntries([...m].map(([k, set]) => [k, [...set]]));

const clone = (o) => JSON.parse(JSON.stringify(o));

export class Game {
  constructor(id, { wordListId = DEFAULT_WORD_LIST_ID, streamerMode = false } = {}, hooks = {}) {
    this.id = id;
    this.hooks = hooks;
    this.teams = [
      { name: 'team 1', userIds: [] },
      { name: 'team 2', userIds: [] },
    ];
    this.users = {};
    this.previousRounds = [];
    this.currentRound = undefined;
    this.finalRound = undefined;
    this.settings = {
      numRounds: 15,
      roundLengthSec: 60,
      hideWordLength: false,
      streamerMode: !!streamerMode,
      wordListId,
      allowLateJoin: true,
    };
    this.nextGameId = undefined;
    this.sockets = new Map(); // userId -> Set<ws>
    this.spectators = new Set();
    this.ready = new Set();
    this.readyToggledAt = new Map(); // userId -> time of the last ready / unready click
    this.timers = new Set();
    this.lobbyTimers = new Map();
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.finished = false;
    this.endedEarly = undefined; // 'vote' | 'empty' when the game was stopped before its natural end
    this.ended = false; // true once the game is over without a final drawdown
    this.endedAt = undefined;
    this.chat = [];
    this.chatSeq = 0;
    this.chatLog = new Map(); // userId -> recent send times (rate limit)
    this.presenceLog = new Map(); // userId -> recent presence change times (rate limit)
    this.preShuffleTeams = undefined; // manual teams saved while a random-teams countdown runs
    this.banned = new Set(); // vote-kicked user ids
    this.kickVotes = new Map(); // targetId -> Set<voterId>
    this.switchAppeals = new Map(); // appellantId -> Set<voterId>
    this.endVotes = new Set(); // voter ids: more than half of the active players ends the game early
    this.emptyTimer = undefined;
    this.chooserTimer = undefined;
    this.chosenByTeam = -1;
    this.availableWords = [];
    this.usedWords = [];
  }

  // ---------- helpers ----------
  rule(key) {
    let v = this.settings ? this.settings[key] : undefined;
    const d = DEFAULT_RULES[key];
    if (typeof v !== typeof d || (typeof v === 'number' && !Number.isFinite(v))) return d;
    const r = RULE_RANGES[key];
    if (r) v = Math.min(r[1], Math.max(r[0], Math.round(v)));
    return v;
  }
  get fz() {
    return this.rule('fuzzyMatch');
  }
  now() {
    return Date.now();
  }
  touch() {
    this.lastActivity = Date.now();
  }
  get started() {
    return this.currentRound !== undefined || this.finalRound !== undefined || this.ended;
  }
  get inCountdown() {
    return (
      this.currentRound !== undefined &&
      this.previousRounds.length === 0 &&
      this.currentRound.startTime > this.now()
    );
  }
  socketTotal() {
    let n = this.spectators.size;
    for (const set of this.sockets.values()) n += set.size;
    return n;
  }
  // players currently on a team (vote-kicked players keep a user record for the recap but are on no team)
  get userCount() {
    return this.teams.reduce((n, t) => n + t.userIds.length, 0);
  }
  // players on a team with a live connection; spectators do not count
  activePlayers() {
    return this.teams.flatMap((t) => t.userIds).filter((id) => this.users[id] && this.users[id].status === Status.Connected);
  }
  get activeCount() {
    return this.activePlayers().length;
  }
  teamIndexOf(userId) {
    return this.teams.findIndex((t) => t.userIds.includes(userId));
  }
  isConnected(userId) {
    const s = this.sockets.get(userId);
    return !!s && s.size > 0;
  }

  // ---------- snapshots ----------
  // includeCanvas: 'none' | 'current' | 'all'
  snapshot(includeCanvas = 'current', withChat = false) {
    const stripRound = (round, keepCanvas) => {
      const r = { ...round };
      r.teamStates = round.teamStates.map((ts) => {
        const o = { ...ts };
        if (!keepCanvas) delete o.canvasOperations;
        return o;
      });
      return r;
    };
    const out = {
      id: this.id,
      teams: this.teams,
      users: this.users,
      previousRounds: this.previousRounds.map((r) => stripRound(r, includeCanvas === 'all')),
      settings: this.settings,
      createdAt: this.createdAt,
      kickVotes: mapOfSets(this.kickVotes),
      switchAppeals: mapOfSets(this.switchAppeals),
      endVotes: [...this.endVotes],
    };
    if (this.ended) out.ended = true;
    if (this.endedEarly) out.endedEarly = this.endedEarly;
    if (withChat) out.chat = this.chat;
    if (this.currentRound) out.currentRound = stripRound(this.currentRound, includeCanvas !== 'none');
    if (this.finalRound) {
      out.finalRound = {
        ...this.finalRound,
        teamStates: this.finalRound.teamStates.map((states) =>
          states.map((st) => {
            const o = { ...st };
            if (includeCanvas === 'none') delete o.canvasOperations;
            return o;
          }),
        ),
      };
    }
    if (this.nextGameId) out.nextGameId = this.nextGameId;
    return out;
  }

  // compact public description for the lobbies list
  lobbyInfo() {
    const names = (t) => t.userIds.map((id) => this.users[id]).filter(Boolean);
    const players = this.teams.flatMap((t, ti) =>
      names(t).map((u) => ({ name: u.name || 'anonymous', team: ti, connected: u.status !== Status.Disconnected })),
    );
    const maxTeam = this.rule('maxTeamSize');
    const capacity = maxTeam * this.teams.length;
    let stage = 'lobby';
    let round = 0;
    if (this.finished) stage = 'ended';
    else if (this.finalRound) stage = 'final';
    else if (this.currentRound) {
      round = this.previousRounds.length + 1;
      stage = this.inCountdown ? 'starting' : 'playing';
    }
    const started = stage === 'playing' || stage === 'final' || stage === 'ended';
    return {
      id: this.id,
      players,
      teamNames: this.teams.map((t) => t.name),
      capacity,
      stage,
      round,
      numRounds: this.settings.numRounds,
      full: this.teams.every((t) => t.userIds.length >= maxTeam),
      canJoin: !started && stage !== 'starting' && !this.teams.every((t) => t.userIds.length >= maxTeam),
      canSpectate: this.rule('allowSpectators'),
      spectators: this.spectators.size,
    };
  }

  // ---------- sending ----------
  send(ws, msg) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  }
  broadcast(msg, exceptWs) {
    const data = JSON.stringify(msg);
    const each = (ws) => {
      if (ws !== exceptWs && ws.readyState === 1) ws.send(data);
    };
    for (const set of this.sockets.values()) set.forEach(each);
    this.spectators.forEach(each);
  }

  // ---------- connections ----------
  connect(ws, { userId, userName, spectate, rating, team }) {
    this.touch();
    ws.gameCtx = { userId, spectate: !!spectate };
    if (spectate && !this.rule('allowSpectators')) {
      this.send(ws, [S.ServerError, { type: 'Closed', gameId: this.id, reason: 'spectators' }]);
      ws.close(1000);
      return;
    }
    if (spectate) {
      ws.gameCtx.name = typeof userName === 'string' ? sanitizeName(userName) : '';
      this.spectators.add(ws);
      this.send(ws, [S.SessionStart, this.snapshot('current', true), this.now()]);
      if (this.started) this.send(ws, [S.ReadyUp, this.previousRounds.length, [...this.ready]]);
      return;
    }
    if (this.banned.has(userId)) {
      this.send(ws, [S.ServerError, { type: 'Kicked', gameId: this.id }]);
      ws.close(1000);
      return;
    }
    if (userName !== undefined) userName = sanitizeName(userName);
    const existing = this.users[userId];
    if (this.lobbyTimers.has(userId)) {
      clearTimeout(this.lobbyTimers.get(userId));
      this.lobbyTimers.delete(userId);
    }
    if (existing) {
      if (userName !== undefined && !this.started) existing.name = userName;
      if (rating !== undefined && !this.started) existing.rating = sanitizeRating(rating);
      const wasDisconnected = existing.status === Status.Disconnected;
      existing.status = Status.Connected;
      this.addSocket(userId, ws);
      this.send(ws, [S.SessionStart, this.snapshot('current', true), this.now()]);
      if (this.started) this.send(ws, [S.ReadyUp, this.previousRounds.length, [...this.ready]]);
      if (wasDisconnected || this.started) this.broadcast([S.UserReconnect, userId], ws);
      if (wasDisconnected) this.recheckVotes();
      return;
    }
    if (this.started && !this.rule('allowLateJoin')) {
      this.send(ws, [S.ServerError, { type: 'Closed', gameId: this.id, reason: 'late' }]);
      ws.close(1000);
      return;
    }
    if (userName === undefined) {
      // unknown user without a name: nothing to join as
      ws.close(1008, 'unknown user');
      return;
    }
    // new user joins the smaller team (ties -> team 1)
    // rating: the player's own score, kept on their device; it is frozen once the game has started
    const user = { id: userId, name: userName, status: Status.Connected, rating: sanitizeRating(rating) };
    this.users[userId] = user;
    let ti = this.teams[0].userIds.length <= this.teams[1].userIds.length ? 0 : 1;
    if (this.teams[ti].userIds.length >= this.rule('maxTeamSize')) ti = 1 - ti;
    // joining a game in progress: the player may pick the team when the lobby allows it
    const wanted = Number(team);
    if (
      this.started &&
      this.rule('lateJoinPickTeam') &&
      Number.isInteger(wanted) &&
      wanted >= 0 &&
      wanted < this.teams.length &&
      this.teams[wanted].userIds.length < this.rule('maxTeamSize')
    ) {
      ti = wanted;
    }
    this.teams[ti].userIds.push(userId);
    this.addSocket(userId, ws);
    this.broadcast([S.JoinGame, user, this.teams], ws);
    this.send(ws, [S.SessionStart, this.snapshot('current', true), this.now()]);
    if (this.started) this.send(ws, [S.ReadyUp, this.previousRounds.length, [...this.ready]]);
    this.recheckVotes();
  }

  addSocket(userId, ws) {
    this.clearEmptyTimer();
    let set = this.sockets.get(userId);
    if (!set) {
      set = new Set();
      this.sockets.set(userId, set);
    }
    set.add(ws);
  }

  disconnect(ws) {
    this.touch();
    const ctx = ws.gameCtx;
    if (!ctx) return;
    if (ctx.spectate) {
      this.spectators.delete(ws);
      return;
    }
    const set = this.sockets.get(ctx.userId);
    if (set) {
      set.delete(ws);
      if (set.size > 0) return;
      this.sockets.delete(ctx.userId);
    }
    const user = this.users[ctx.userId];
    if (!user || user.status === Status.Kicked) return;
    if (!this.started) {
      this.removeFromLobby(ctx.userId);
    } else {
      user.status = Status.Disconnected;
      delete user.presence;
      this.broadcast([S.UserDisconnect, ctx.userId]);
      this.recheckVotes();
      this.maybeAdvance();
      this.watchEmpty();
    }
  }

  // everybody left a game in progress: after a short grace period (page refreshes, wifi blips) it is ended and scored
  watchEmpty() {
    if (this.finished || this.emptyTimer || this.activeCount > 0 || this.inCountdown || !this.started) return;
    this.emptyTimer = setTimeout(() => {
      this.emptyTimer = undefined;
      if (this.activeCount === 0 && !this.inCountdown) this.endEarly('empty');
    }, EMPTY_END_MS);
    this.emptyTimer.unref?.();
  }
  clearEmptyTimer() {
    if (this.emptyTimer) clearTimeout(this.emptyTimer);
    this.emptyTimer = undefined;
  }

  removeFromLobby(userId) {
    delete this.users[userId];
    for (const t of this.teams) t.userIds = t.userIds.filter((u) => u !== userId);
    this.broadcast([S.UserLobbyDisconnect, userId, this.teams]);
    this.dropVotesOf(userId);
    this.recheckVotes();
  }

  // ---------- message handling ----------
  handleMessage(ws, raw) {
    this.touch();
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(msg)) return;
    const ctx = ws.gameCtx;
    if (!ctx) return;
    if (ctx.spectate) {
      // spectators may only talk
      if (msg[0] === C.Chat) this.onChat(ws, undefined, msg[1]);
      return;
    }
    const userId = ctx.userId;
    if (!this.users[userId] || this.users[userId].status === Status.Kicked) return;
    switch (msg[0]) {
      case C.UserGuess:
        return this.onGuess(userId, msg[1], msg[2]);
      case C.StartGame:
        return this.onStartGame(userId);
      case C.CancelStartGame:
        return this.onCancelStart(userId);
      case C.JoinTeam:
        return this.onJoinTeam(userId, msg[1]);
      case C.UpdateUserName:
        return this.onUpdateName(userId, msg[1]);
      case C.UpdateSettings:
        return this.onUpdateSettings(userId, msg[1]);
      case C.ChooseWord:
        return this.onChooseWord(userId, msg[1], msg[2]);
      case C.ReadyUp:
        return this.onReadyUp(userId, msg[1]);
      case C.CanvasOperation:
        return this.onCanvasOperation(ws, userId, msg[1], msg[2]);
      case C.ForceStartNextRound:
        return this.onForceStart(userId, msg[1]);
      case C.Chat:
        return this.onChat(ws, userId, msg[1]);
      case C.VoteKick:
        return this.onVoteKick(userId, msg[1]);
      case C.SwitchAppeal:
        return this.onSwitchAppeal(userId);
      case C.SwitchVote:
        return this.onSwitchVote(userId, msg[1]);
      case C.Presence:
        return this.onPresence(userId, msg[1]);
      case C.VoteEnd:
        return this.onVoteEnd(userId);
      default:
        return;
    }
  }

  onJoinTeam(userId, teamIndex) {
    if (this.started) return;
    const cur = this.teamIndexOf(userId);
    for (const t of this.teams) t.userIds = t.userIds.filter((u) => u !== userId);
    if (Number.isInteger(teamIndex) && teamIndex >= 0 && teamIndex < this.teams.length) {
      if (this.teams[teamIndex].userIds.length < this.rule('maxTeamSize')) this.teams[teamIndex].userIds.push(userId);
      else if (cur >= 0) this.teams[cur].userIds.push(userId);
    }
    this.broadcast([S.UpdateTeams, this.teams]);
  }

  // 0 = active, 1 = window not focused, 2 = quick switch open. Only changes are relayed, and only a few per window.
  onPresence(userId, state) {
    const user = this.users[userId];
    if (!user || (state !== 0 && state !== 1 && state !== 2)) return;
    if ((user.presence || 0) === state) return;
    const now = Date.now();
    const log = (this.presenceLog.get(userId) || []).filter((t) => now - t < PRESENCE_WINDOW_MS);
    if (log.length >= PRESENCE_BURST) return;
    log.push(now);
    this.presenceLog.set(userId, log);
    if (state === 0) delete user.presence;
    else user.presence = state;
    this.broadcast([S.Presence, userId, state]);
  }

  onUpdateName(userId, name) {
    if (typeof name !== 'string') return;
    const user = this.users[userId];
    user.name = sanitizeName(name);
    this.broadcast([S.UpdateUser, user]);
  }

  // ---------- chat ----------
  addChat(msg) {
    const m = { id: ++this.chatSeq, ts: Date.now(), ...msg };
    this.chat.push(m);
    if (this.chat.length > CHAT_HISTORY) this.chat.splice(0, this.chat.length - CHAT_HISTORY);
    this.broadcast([S.Chat, m]);
  }
  systemChat(text) {
    this.addChat({ sys: true, text });
  }
  // a notice only the sender sees (not stored)
  chatNotice(ws, text) {
    this.send(ws, [S.Chat, { id: `n${++this.chatSeq}`, ts: Date.now(), sys: true, text }]);
  }

  // words that are live right now: sharing them in chat would spoil the round
  liveWords() {
    const words = [];
    const r = this.currentRound;
    if (r && r.word !== undefined && !this.inScoreScreen()) words.push(r.word);
    const fr = this.finalRound;
    if (fr && !this.finished) for (const states of fr.teamStates) words.push(fr.words[states.length - 1]);
    return words;
  }
  chatSpoils(text) {
    const flat = normalizeGuess(text);
    const tokens = text.split(/\s+/).map(normalizeGuess);
    return this.liveWords().some((w) => {
      const nw = normalizeGuess(w);
      if (!nw) return false;
      return tokens.includes(nw) || (nw.length >= 4 && flat.includes(nw));
    });
  }

  onChat(ws, userId, text) {
    if (typeof text !== 'string') return;
    const body = Array.from(text.replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim())
      .slice(0, MAX_CHAT_LENGTH)
      .join('');
    if (!body) return;
    const now = Date.now();
    // spectators have no player record: their rate limit lives on the socket and their messages carry no user id
    const spectator = userId === undefined;
    const recent = ((spectator ? ws.chatTimes : this.chatLog.get(userId)) || []).filter((t) => now - t < CHAT_WINDOW_MS);
    if (spectator) ws.chatTimes = recent;
    else this.chatLog.set(userId, recent);
    if (recent.length >= CHAT_BURST) return this.chatNotice(ws, 'slow down a little!');
    if (this.chatSpoils(body)) return this.chatNotice(ws, "don't give away the word!");
    recent.push(now);
    if (spectator) return this.addChat({ spec: true, name: (ws.gameCtx && ws.gameCtx.name) || '', text: body });
    const user = this.users[userId];
    this.addChat({ userId, name: user.name, team: this.teamIndexOf(userId), text: body });
  }

  // ---------- voting (vote kick, team switch appeals) ----------
  // players who may vote: connected players on a team, minus the one being voted about
  votersFor(excludeId) {
    return this.activePlayers().filter((id) => id !== excludeId);
  }
  broadcastVotes() {
    this.broadcast([S.KickVotes, mapOfSets(this.kickVotes)]);
    this.broadcast([S.SwitchAppeals, mapOfSets(this.switchAppeals)]);
  }
  dropVotesOf(userId) {
    this.kickVotes.delete(userId);
    this.switchAppeals.delete(userId);
    this.endVotes.delete(userId);
    for (const [k, set] of this.kickVotes) {
      set.delete(userId);
      if (set.size === 0) this.kickVotes.delete(k);
    }
    for (const set of this.switchAppeals.values()) set.delete(userId);
  }
  clearAppeals() {
    if (this.switchAppeals.size === 0) return;
    this.switchAppeals.clear();
    this.broadcastVotes();
  }

  onVoteKick(userId, targetId) {
    if (this.finished || typeof targetId !== 'string' || targetId === userId) return;
    const target = this.users[targetId];
    const ti = this.teamIndexOf(targetId);
    if (!target || ti < 0) return;
    if (this.teamIndexOf(userId) < 0 || this.users[userId].status !== Status.Connected) return;
    if (!this.canLoseMember(ti)) return;
    if (this.activeCount < MIN_VOTE_PLAYERS) return;
    let votes = this.kickVotes.get(targetId);
    if (!votes) this.kickVotes.set(targetId, (votes = new Set()));
    if (votes.has(userId)) votes.delete(userId);
    else votes.add(userId);
    if (votes.size === 0) this.kickVotes.delete(targetId);
    this.broadcastVotes();
    this.recheckVotes(true);
  }

  // a team must keep at least 2 players; in a random-teams lobby only the total counts (teams are drawn at the start)
  canLoseMember(ti) {
    if (!this.started && this.settings.randomTeams === true) return this.userCount > MIN_RANDOM_PLAYERS;
    return this.teams[ti].userIds.length >= 3;
  }

  // more than half of the other active players must agree
  votePasses(votes, voters) {
    return voters.length >= 2 && voters.filter((v) => votes.has(v)).length >= voteThreshold(voters.length);
  }

  // called whenever the pool of voters or the teams change; carries out any vote that now passes
  // fromVote: a vote was just cast, so passing votes are carried out. Plain connection changes only clean up:
  // a flaky connection must never tip an old partial vote over the threshold.
  recheckVotes(fromVote = false) {
    if (this.rechecking || this.finished) return;
    this.rechecking = true;
    let changed = false;
    try {
      for (let guard = 0; guard < 50; guard++) {
        const kick = !fromVote ? undefined : [...this.kickVotes].find(([id, votes]) => {
          if (!this.users[id] || this.teamIndexOf(id) < 0) return false;
          return this.votePasses(votes, this.votersFor(id));
        });
        if (kick) {
          this.kick(kick[0]);
          continue;
        }
        const appeal = !fromVote ? undefined : [...this.switchAppeals].find(([id, votes]) => {
          if (!this.canSwitch(id)) return false;
          return this.votePasses(votes, this.votersFor(id));
        });
        if (appeal) {
          this.switchTeam(appeal[0]);
          continue;
        }
        // appeals that can no longer succeed (team shrank, voters left) are withdrawn
        for (const id of [...this.switchAppeals.keys()]) {
          if (!this.canSwitch(id)) {
            this.switchAppeals.delete(id);
            changed = true;
          }
        }
        break;
      }
    } finally {
      this.rechecking = false;
    }
    if (changed) this.broadcastVotes();
  }

  kick(targetId) {
    const user = this.users[targetId];
    const ti = this.teamIndexOf(targetId);
    this.banned.add(targetId);
    this.rotateDrawerOf(targetId, ti);
    this.teams[ti].userIds = this.teams[ti].userIds.filter((id) => id !== targetId);
    this.ready.delete(targetId);
    this.dropVotesOf(targetId);
    // before the game starts a kicked player is simply gone; later they stay on record for the recap
    const inLobby = !this.started || this.inCountdown;
    if (inLobby) delete this.users[targetId];
    else user.status = Status.Kicked;
    const socks = this.sockets.get(targetId);
    this.sockets.delete(targetId);
    if (socks) {
      for (const ws of socks) {
        this.send(ws, [S.ServerError, { type: 'Kicked', gameId: this.id }]);
        ws.close(1000);
      }
    }
    this.broadcast([S.UserKicked, targetId, this.teams, inLobby]);
    this.broadcastVotes();
    this.systemChat(`${user.name || 'anonymous'} was vote-kicked`);
    this.maybeAdvance();
  }

  // hand the pen to a teammate when the current drawer is about to leave the game
  rotateDrawerOf(targetId, ti) {
    const ids = this.teams[ti].userIds;
    const replacement = () => {
      const id = this.nextDrawer(ti, targetId);
      return id !== targetId ? id : ids.find((u) => u !== targetId);
    };
    const wipe = (ref, state) => {
      for (const op of [[Op.ClearCanvas], [Op.ChangeTool, 'pencil'], [Op.ChangeColor, '000000'], [Op.ChangeStrokeWidth, 1]]) {
        state.canvasOperations.push(op);
        this.broadcast([S.CanvasOperation, ref, ti, op]);
      }
    };
    const round = this.currentRound;
    if (round && round.teamStates[ti].drawerId === targetId && !this.inScoreScreen()) {
      const state = round.teamStates[ti];
      state.drawerId = replacement();
      if (round.chooserId === targetId) round.chooserId = state.drawerId;
      const ref = this.previousRounds.length;
      wipe(ref, state);
      this.broadcast([S.DrawerRotated, ref, ti, state.drawerId, round.chooserId]);
    }
    const fr = this.finalRound;
    if (fr && !this.finished) {
      const states = fr.teamStates[ti];
      const idx = states.length - 1;
      if (states[idx].drawerId === targetId) {
        states[idx].drawerId = replacement();
        wipe([idx], states[idx]);
        this.broadcast([S.DrawerRotated, [idx], ti, states[idx].drawerId]);
      }
    }
  }

  // ---------- ending the game early ----------
  // a game in progress can be ended by more than half of the active players; the score is worked out right away
  canVoteEnd() {
    return this.started && !this.finished && !this.inCountdown;
  }
  endVotesPass() {
    const voters = this.activePlayers();
    return voters.length >= 1 && voters.filter((v) => this.endVotes.has(v)).length >= voteThreshold(voters.length);
  }
  onVoteEnd(userId) {
    if (!this.canVoteEnd()) return;
    const user = this.users[userId];
    if (this.teamIndexOf(userId) < 0 || !user || user.status !== Status.Connected) return;
    const first = this.endVotes.size === 0;
    if (this.endVotes.has(userId)) this.endVotes.delete(userId);
    else this.endVotes.add(userId);
    this.broadcast([S.EndVotes, [...this.endVotes]]);
    if (this.endVotesPass()) return this.endEarly('vote');
    if (first && this.endVotes.has(userId)) this.systemChat(`${user.name || 'anonymous'} wants to end the game`);
  }

  // stops the game right now: the round in progress counts as it stands (if its word was already chosen)
  endEarly(reason = 'vote') {
    if (this.finished || !this.started) return;
    this.endedEarly = reason;
    this.clearChooserTimer();
    this.clearEmptyTimer();
    this.switchAppeals.clear();
    const round = this.currentRound;
    let kept = false;
    if (round) {
      if (round.word !== undefined) {
        this.previousRounds.push(round);
        kept = true;
      }
      this.currentRound = undefined;
    }
    this.ended = true;
    this.endVotes.clear();
    this.ready = new Set();
    this.broadcast([S.GameEnded, kept, reason]);
    this.broadcast([S.EndVotes, []]);
    this.broadcast([S.SwitchAppeals, {}]);
    this.finishGame();
  }

  // ---------- team switch appeals (between rounds only) ----------
  betweenRounds() {
    const r = this.currentRound;
    return !this.finished && !this.ended && !!r && r.word !== undefined && this.inScoreScreen();
  }
  teamActiveCount(ti) {
    return this.teams[ti].userIds.filter((id) => this.users[id] && this.users[id].status === Status.Connected).length;
  }
  // a player may appeal when their team keeps at least 2 active players without them
  canSwitch(userId) {
    const ti = this.teamIndexOf(userId);
    if (ti < 0 || !this.users[userId] || this.users[userId].status !== Status.Connected) return false;
    if (this.settings.randomTeams === true) return false; // teams are drawn at random, nobody picks one
    if (this.teamActiveCount(ti) <= 2) return false;
    if (this.teams[1 - ti].userIds.length >= this.rule('maxTeamSize')) return false;
    return this.votersFor(userId).length >= 2;
  }
  onSwitchAppeal(userId) {
    if (!this.betweenRounds()) return;
    if (this.switchAppeals.has(userId)) {
      this.switchAppeals.delete(userId);
      return this.broadcastVotes();
    }
    if (!this.canSwitch(userId)) return;
    this.switchAppeals.set(userId, new Set());
    this.broadcastVotes();
    this.systemChat(`${this.users[userId].name || 'anonymous'} asked to switch teams`);
  }
  onSwitchVote(userId, appellantId) {
    if (!this.betweenRounds() || typeof appellantId !== 'string' || appellantId === userId) return;
    const votes = this.switchAppeals.get(appellantId);
    if (!votes || this.teamIndexOf(userId) < 0 || this.users[userId].status !== Status.Connected) return;
    if (votes.has(userId)) votes.delete(userId);
    else votes.add(userId);
    this.broadcastVotes();
    this.recheckVotes(true);
  }
  switchTeam(userId) {
    const ti = this.teamIndexOf(userId);
    this.teams[ti].userIds = this.teams[ti].userIds.filter((id) => id !== userId);
    this.teams[1 - ti].userIds.push(userId);
    this.switchAppeals.delete(userId);
    this.broadcast([S.UpdateTeams, this.teams]);
    this.broadcastVotes();
    this.systemChat(`${this.users[userId].name || 'anonymous'} switched to ${this.teams[1 - ti].name}`);
  }

  onUpdateSettings(userId, settings) {
    if (this.started) return;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return;
    const next = { ...settings };
    for (const [k, [lo, hi]] of Object.entries(SETTING_RANGES)) {
      const v = Math.round(Number(next[k]));
      next[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : this.settings[k];
    }
    next.randomTeams = next.randomTeams === true;
    this.settings = next;
    this.broadcast([S.UpdateSettings, this.settings]);
  }

  // ---------- starting ----------
  canStart() {
    if (this.started) return false;
    if (this.settings.randomTeams === true) return this.userCount >= MIN_RANDOM_PLAYERS;
    if (this.teams.some((t) => t.userIds.length < 2)) return false;
    return true;
  }

  // random teams: everyone is drawn into two teams; with an odd number a coin flip decides which team is bigger.
  // The manual teams are kept aside so cancelling the countdown puts everyone back exactly where they were.
  shuffleTeams() {
    this.preShuffleTeams = this.teams.map((t) => [...t.userIds]);
    const ids = shuffle(this.teams.flatMap((t) => t.userIds));
    const half = Math.floor(ids.length / 2);
    const extra = ids.length % 2 === 1 && Math.random() < 0.5 ? 1 : 0;
    const cut = half + extra;
    this.teams[0].userIds = ids.slice(0, cut);
    this.teams[1].userIds = ids.slice(cut);
    this.broadcast([S.UpdateTeams, this.teams]);
  }
  restoreTeams() {
    const pre = this.preShuffleTeams;
    this.preShuffleTeams = undefined;
    if (!pre) return;
    const current = new Set(this.teams.flatMap((t) => t.userIds));
    const placed = new Set();
    this.teams.forEach((t, i) => {
      t.userIds = pre[i].filter((id) => current.has(id));
      t.userIds.forEach((id) => placed.add(id));
    });
    // players who arrived during the countdown join the smaller team
    for (const id of current) {
      if (placed.has(id)) continue;
      const small = this.teams[0].userIds.length <= this.teams[1].userIds.length ? 0 : 1;
      this.teams[small].userIds.push(id);
    }
    this.broadcast([S.UpdateTeams, this.teams]);
  }

  // the pack's words after the single-word / length filters (ignored if too few words would remain)
  wordPool() {
    const all = getWords(this.settings.wordListId) || [];
    const maxLen = this.rule('maxWordLength');
    const single = this.rule('singleWordsOnly');
    if (!maxLen && !single) return all;
    const filtered = all.filter((w) => (!single || !/\s/.test(w)) && (!maxLen || w.length <= maxLen));
    return filtered.length >= 2 * this.settings.numRounds + 4 ? filtered : all;
  }

  onStartGame() {
    if (!this.canStart()) return;
    const words = this.wordPool();
    if (!words || words.length < 2 * this.settings.numRounds) return;
    this.availableWords = shuffle(words);
    this.usedWords = [];
    this.ready = new Set();
    if (this.settings.randomTeams === true) this.shuffleTeams();
    const drawers = this.teams.map((t) => t.userIds[0]);
    const chooserTeam = Math.floor(Math.random() * this.teams.length);
    this.startRound(0, drawers, drawers[chooserTeam], 0, this.now() + this.rule('startCountdownSec') * 1000);
  }

  onCancelStart() {
    if (this.inCountdown) {
      this.clearChooserTimer();
      this.currentRound = undefined;
      this.usedWords = [];
      this.restoreTeams();
    }
    this.broadcast([S.CancelStartGame]);
  }

  drawWords(n) {
    const out = [];
    while (out.length < n) {
      if (this.availableWords.length === 0) {
        const words = this.wordPool();
        this.availableWords = shuffle(words.filter((w) => !this.usedWords.includes(w)));
        if (this.availableWords.length === 0) this.availableWords = shuffle(words);
      }
      out.push(this.availableWords.pop());
    }
    return out;
  }

  startRound(index, drawers, chooserId, headStartSec, startTime) {
    this.ready = new Set();
    this.chosenByTeam = -1;
    const wordChoices = this.drawWords(this.rule('wordChoiceCount'));
    const round = {
      wordChoices,
      chooserId,
      chooserHeadStartSeconds: headStartSec,
      startTime,
      teamStates: drawers.map((d) => ({ drawerId: d, canvasOperations: [], guesses: [] })),
    };
    if (this.currentRound) this.previousRounds[index - 1] = this.currentRound;
    this.currentRound = round;
    this.broadcast([S.StartRound, index, round, this.now()]);
    this.scheduleAutoChoose(index);
  }

  clearChooserTimer() {
    if (this.chooserTimer) clearTimeout(this.chooserTimer);
    this.chooserTimer = undefined;
  }

  scheduleAutoChoose(index) {
    this.clearChooserTimer();
    const round = this.currentRound;
    const at = round.startTime + this.rule('chooseWordSec') * 1000;
    this.chooserTimer = setTimeout(
      () => {
        if (this.currentRound === round && this.previousRounds.length === index && round.word === undefined) {
          // clients make the same choice locally, so nothing is broadcast
          round.word = round.wordChoices[0];
          round.wordChosenTime = at;
          this.usedWords.push(round.word);
          this.chosenByTeam = this.teamIndexOfDrawer(round, round.chooserId);
        }
      },
      Math.max(0, at - this.now()),
    );
  }

  onChooseWord(userId, roundIndex, word) {
    const round = this.currentRound;
    if (!round || roundIndex !== this.previousRounds.length) return;
    if (round.word !== undefined) return;
    if (!round.teamStates.some((ts) => ts.drawerId === userId)) return;
    if (!round.wordChoices.includes(word)) return;
    this.clearChooserTimer();
    round.word = word;
    round.wordChosenTime = this.now();
    this.usedWords.push(word);
    this.chosenByTeam = this.teamIndexOfDrawer(round, userId);
    this.broadcast([S.WordChosen, roundIndex, word, round.wordChosenTime]);
  }

  teamIndexOfDrawer(round, userId) {
    return round.teamStates.findIndex((ts) => ts.drawerId === userId);
  }

  // ---------- guessing & drawing ----------
  onGuess(userId, roundIndex, guess) {
    if (typeof guess !== 'string' || guess.length > MAX_GUESS_LENGTH) return;
    const ti = this.teamIndexOf(userId);
    if (ti < 0) return;
    const ts = Date.now();
    if (Array.isArray(roundIndex)) {
      const fr = this.finalRound;
      if (!fr) return;
      const idx = roundIndex[0];
      const states = fr.teamStates[ti];
      if (idx !== states.length - 1) return;
      const state = states[idx];
      const g = { userId, guess, timestamp: ts };
      state.guesses.push(g);
      this.broadcast([S.UserGuess, [idx], ti, g]);
      if (guessMatches(guess, fr.words[idx], this.fz)) this.onFinalWordGuessed(ti, idx, ts);
      return;
    }
    const round = this.currentRound;
    if (!round || roundIndex !== this.previousRounds.length) return;
    const g = { userId, guess, timestamp: ts };
    round.teamStates[ti].guesses.push(g);
    this.broadcast([S.UserGuess, roundIndex, ti, g]);
  }

  onCanvasOperation(ws, userId, roundIndex, op) {
    if (!Array.isArray(op)) return;
    const ti = this.teamIndexOf(userId);
    if (ti < 0) return;
    if (Array.isArray(roundIndex)) {
      const fr = this.finalRound;
      if (!fr) return;
      const idx = roundIndex[0];
      const states = fr.teamStates[ti];
      if (idx !== states.length - 1) return;
      if (states[idx].drawerId !== userId) return;
      states[idx].canvasOperations.push(op);
      this.broadcast([S.CanvasOperation, [idx], ti, op], ws);
      return;
    }
    const round = this.currentRound;
    if (!round || roundIndex !== this.previousRounds.length) return;
    if (round.teamStates[ti].drawerId !== userId) return;
    round.teamStates[ti].canvasOperations.push(op);
    this.broadcast([S.CanvasOperation, roundIndex, ti, op], ws);
  }

  // ---------- ready up / next round ----------
  roundEndTime(round) {
    // time at which both teams have guessed, else null
    let latest;
    for (const ts of round.teamStates) {
      const g = findCorrectGuess(ts.guesses, round.word, this.fz);
      if (!g) return undefined;
      if (!latest || g.timestamp > latest) latest = g.timestamp;
    }
    return latest;
  }

  scoreScreenTime(round) {
    const both = this.roundEndTime(round);
    const drawStart = round.wordChosenTime + this.rule('drawingCountdownSec') * 1000 + round.chooserHeadStartSeconds * 1000;
    const end = both !== undefined ? both : drawStart + this.settings.roundLengthSec * 1000;
    return end + this.rule('roundEndSec') * 1000;
  }

  inScoreScreen() {
    const round = this.currentRound;
    if (!round || round.wordChosenTime === undefined) return false;
    const both = this.roundEndTime(round);
    const drawStart = round.wordChosenTime + this.rule('drawingCountdownSec') * 1000 + round.chooserHeadStartSeconds * 1000;
    const end = both !== undefined ? both : drawStart + this.settings.roundLengthSec * 1000;
    return this.now() >= end + this.rule('roundEndSec') * 1000;
  }

  onReadyUp(userId, roundIndex) {
    if (!this.currentRound || roundIndex !== this.previousRounds.length) return;
    // clicking again takes the ready back; one click a second so it cannot be spammed
    const now = this.now();
    if (now - (this.readyToggledAt.get(userId) ?? -Infinity) < READY_COOLDOWN_MS) return;
    this.readyToggledAt.set(userId, now);
    if (this.ready.has(userId)) this.ready.delete(userId);
    else {
      this.ready.add(userId);
      if (this.allReady()) return this.advance();
    }
    this.broadcast([S.ReadyUp, roundIndex, [...this.ready]]);
  }

  allReady() {
    const connected = Object.values(this.users).filter((u) => u.status === Status.Connected);
    if (connected.length === 0) return false;
    if (!connected.every((u) => this.ready.has(u.id))) return false;
    return this.teams.every((t) => t.userIds.filter((u) => this.users[u].status === Status.Connected).length >= 2);
  }

  maybeAdvance() {
    // a disconnect may complete the set of ready users
    if (this.currentRound && this.currentRound.word !== undefined && this.ready.size > 0 && this.allReady()) {
      this.advance();
    }
  }

  onForceStart(userId, roundIndex) {
    if (!this.currentRound || roundIndex !== this.previousRounds.length) return;
    // only valid once the round is over (the score screen is showing)
    if (this.currentRound.wordChosenTime === undefined || this.now() < this.scoreScreenTime(this.currentRound) - 1500) return;
    this.ready.add(userId); // whoever forces the start is obviously present
    this.advance(true);
  }

  nextDrawer(teamIndex, current) {
    const team = this.teams[teamIndex];
    const n = team.userIds.indexOf(current);
    // a drawer who left the team (kicked / switched) is not in the list, so every member is a candidate
    const tries = n < 0 ? team.userIds.length : team.userIds.length - 1;
    for (let s = 1; s <= tries; s++) {
      const id = team.userIds[(n + s) % team.userIds.length];
      if (this.users[id] && this.users[id].status !== Status.Disconnected) return id;
    }
    return current;
  }

  // drawers for the next round: winner stays (if connected), everyone else rotates
  computeNextDrawers(lastRound) {
    const winner = roundWinner(lastRound, this.fz);
    return lastRound.teamStates.map((ts, i) => {
      const d = ts.drawerId;
      const stays =
        i === winner &&
        !this.rule('alwaysRotate') &&
        this.teams[i].userIds.includes(d) &&
        this.users[d] &&
        this.users[d].status !== Status.Disconnected;
      return stays ? d : this.nextDrawer(i, d);
    });
  }

  // a forced start must not hand the pen to someone who never readied up: the planned drawer
  // (or the next teammate in line) who is connected and ready takes over
  activeDrawer(teamIndex, planned) {
    const ids = this.teams[teamIndex].userIds;
    const n = Math.max(0, ids.indexOf(planned));
    for (let s = 0; s < ids.length; s++) {
      const id = ids[(n + s) % ids.length];
      if (this.users[id] && this.users[id].status === Status.Connected && this.ready.has(id)) return id;
    }
    return planned;
  }

  streakFor(rounds, drawers) {
    // consecutive wins by the same team and drawer, counted back from the last round
    if (rounds.length === 0 || this.rule('alwaysRotate')) return 0;
    const lastWinner = roundWinner(rounds[rounds.length - 1], this.fz);
    if (lastWinner === undefined) return 0;
    const drawer = rounds[rounds.length - 1].teamStates[lastWinner].drawerId;
    if (drawers[lastWinner] !== drawer) return 0;
    let s = 1;
    for (let i = rounds.length - 2; i >= 0; i--) {
      const w = roundWinner(rounds[i], this.fz);
      if (w !== lastWinner || rounds[i].teamStates[w].drawerId !== drawer) break;
      s += 1;
    }
    return s;
  }

  advance(forced = false) {
    const last = this.currentRound;
    if (!last) return;
    this.clearChooserTimer();
    this.clearAppeals();
    const rounds = [...this.previousRounds, last];
    const index = rounds.length;
    let drawers = this.computeNextDrawers(last);
    if (forced) drawers = drawers.map((d, i) => this.activeDrawer(i, d));
    if (index >= this.settings.numRounds) {
      return this.rule('finalDrawdown') ? this.startFinalRound(rounds, drawers) : this.endWithoutFinal(rounds);
    }
    const winner = roundWinner(last, this.fz);
    const streak = this.streakFor(rounds, drawers);
    const hsBase = this.rule('headStartBase');
    const headStart = !this.rule('headStart') || streak < 2 || hsBase <= 0 ? 0 : hsBase + (streak - 2) * this.rule('headStartStep');
    // the losing team's drawer chooses; with no winner the team that chose last time chooses again
    let chooserTeam;
    if (winner !== undefined) chooserTeam = 1 - winner;
    else chooserTeam = this.chosenByTeam >= 0 ? this.chosenByTeam : last.teamStates.findIndex((ts) => ts.drawerId === last.chooserId);
    this.startRound(index, drawers, drawers[chooserTeam], headStart, this.now());
  }

  startFinalRound(rounds, drawers) {
    const words = shuffle(rounds.map((r) => r.word).filter((w) => w !== undefined));
    const startTime = this.now();
    const firstStart = startTime + (FINAL_PRE_START_SEC + FINAL_START_COUNTDOWN_SEC) * 1000;
    this.previousRounds[rounds.length - 1] = this.currentRound;
    const fr = {
      words,
      startTime,
      teamStates: drawers.map((d) => [{ drawerId: d, canvasOperations: [], guesses: [], startTime: firstStart }]),
    };
    this.finalRound = fr;
    this.currentRound = undefined;
    this.ready = new Set();
    this.broadcast([S.StartFinalRound, fr]);
  }

  // the last round was the end of the game: no final drawdown
  endWithoutFinal(rounds) {
    this.previousRounds[rounds.length - 1] = this.currentRound;
    this.currentRound = undefined;
    this.ended = true;
    this.ready = new Set();
    this.broadcast([S.GameOver]);
    this.finishGame();
  }

  onFinalWordGuessed(teamIndex, idx, ts) {
    const fr = this.finalRound;
    if (idx + 1 >= fr.words.length) {
      this.finishGame(teamIndex, ts);
      return;
    }
    const states = fr.teamStates[teamIndex];
    if (states.length > idx + 1) return;
    const next = {
      drawerId: this.nextDrawer(teamIndex, states[idx].drawerId),
      canvasOperations: [],
      guesses: [],
      startTime: ts + this.rule('finalWordDelaySec') * 1000,
    };
    states.push(next);
    this.broadcast([S.FinalRoundNextWord, idx + 1, teamIndex, next]);
  }

  finishGame() {
    if (this.finished) return;
    this.finished = true;
    this.endedAt = this.now();
    this.hooks.onFinished?.(this);
  }

  // ---------- housekeeping ----------
  destroy() {
    this.clearChooserTimer();
    this.clearEmptyTimer();
    for (const t of this.lobbyTimers.values()) clearTimeout(t);
    for (const set of this.sockets.values()) set.forEach((ws) => ws.close(1000));
    this.spectators.forEach((ws) => ws.close(1000));
  }
}

export { clone, wordListExists, getWordListMeta };
