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
};

export const Status = { Connected: 1, Disconnected: 2 };

// timing constants (seconds) shared with the client
export const DEFAULT_RULES = {
  chooseWordSec: 15,
  wordChoiceCount: 2,
  startCountdownSec: 5,
  drawingCountdownSec: 3,
  roundEndSec: 5,
  headStartBase: 3,
  headStartStep: 1,
  finalWordDelaySec: 2,
  fuzzyMatch: false,
  maxTeamSize: 8,
  alwaysRotate: false,
  allowSpectators: true,
  allowLateJoin: true,
  singleWordsOnly: false,
  maxWordLength: 0,
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
    };
    this.nextGameId = undefined;
    this.sockets = new Map(); // userId -> Set<ws>
    this.spectators = new Set();
    this.ready = new Set();
    this.timers = new Set();
    this.lobbyTimers = new Map();
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.finished = false;
    this.endedAt = undefined;
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
    return this.currentRound !== undefined || this.finalRound !== undefined;
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
  get userCount() {
    return Object.keys(this.users).length;
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
  snapshot(includeCanvas = 'current') {
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
    };
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
  connect(ws, { userId, userName, spectate }) {
    this.touch();
    ws.gameCtx = { userId, spectate: !!spectate };
    if (spectate && !this.rule('allowSpectators')) {
      this.send(ws, [S.ServerError, { type: 'Closed', gameId: this.id, reason: 'spectators' }]);
      ws.close(1000);
      return;
    }
    if (spectate) {
      this.spectators.add(ws);
      this.send(ws, [S.SessionStart, this.snapshot('current'), this.now()]);
      if (this.started) this.send(ws, [S.ReadyUp, this.previousRounds.length, [...this.ready]]);
      return;
    }
    const existing = this.users[userId];
    if (this.lobbyTimers.has(userId)) {
      clearTimeout(this.lobbyTimers.get(userId));
      this.lobbyTimers.delete(userId);
    }
    if (existing) {
      if (userName !== undefined && !this.started) existing.name = userName;
      const wasDisconnected = existing.status === Status.Disconnected;
      existing.status = Status.Connected;
      this.addSocket(userId, ws);
      this.send(ws, [S.SessionStart, this.snapshot('current'), this.now()]);
      if (this.started) this.send(ws, [S.ReadyUp, this.previousRounds.length, [...this.ready]]);
      if (wasDisconnected || this.started) this.broadcast([S.UserReconnect, userId], ws);
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
    const user = { id: userId, name: userName, status: Status.Connected };
    this.users[userId] = user;
    let ti = this.teams[0].userIds.length <= this.teams[1].userIds.length ? 0 : 1;
    if (this.teams[ti].userIds.length >= this.rule('maxTeamSize')) ti = 1 - ti;
    this.teams[ti].userIds.push(userId);
    this.addSocket(userId, ws);
    this.broadcast([S.JoinGame, user, this.teams], ws);
    this.send(ws, [S.SessionStart, this.snapshot('current'), this.now()]);
    if (this.started) this.send(ws, [S.ReadyUp, this.previousRounds.length, [...this.ready]]);
  }

  addSocket(userId, ws) {
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
    if (!user) return;
    if (!this.started) {
      this.removeFromLobby(ctx.userId);
    } else {
      user.status = Status.Disconnected;
      this.broadcast([S.UserDisconnect, ctx.userId]);
      this.maybeAdvance();
    }
  }

  removeFromLobby(userId) {
    delete this.users[userId];
    for (const t of this.teams) t.userIds = t.userIds.filter((u) => u !== userId);
    this.broadcast([S.UserLobbyDisconnect, userId, this.teams]);
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
    if (!ctx || ctx.spectate) return;
    const userId = ctx.userId;
    if (!this.users[userId]) return;
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

  onUpdateName(userId, name) {
    if (typeof name !== 'string') return;
    const user = this.users[userId];
    user.name = name;
    this.broadcast([S.UpdateUser, user]);
  }

  onUpdateSettings(userId, settings) {
    if (this.started) return;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return;
    const next = { ...settings };
    for (const [k, [lo, hi]] of Object.entries(SETTING_RANGES)) {
      const v = Math.round(Number(next[k]));
      next[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : this.settings[k];
    }
    this.settings = next;
    this.broadcast([S.UpdateSettings, this.settings]);
  }

  // ---------- starting ----------
  canStart() {
    if (this.started) return false;
    if (this.teams.some((t) => t.userIds.length < 2)) return false;
    return true;
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
    const drawers = this.teams.map((t) => t.userIds[0]);
    const chooserTeam = Math.floor(Math.random() * this.teams.length);
    this.startRound(0, drawers, drawers[chooserTeam], 0, this.now() + this.rule('startCountdownSec') * 1000);
  }

  onCancelStart() {
    if (this.inCountdown) {
      this.clearChooserTimer();
      this.currentRound = undefined;
      this.usedWords = [];
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
    if (this.ready.has(userId)) return;
    this.ready.add(userId);
    if (this.allReady()) return this.advance();
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
    this.advance();
  }

  nextDrawer(teamIndex, current) {
    const team = this.teams[teamIndex];
    const n = team.userIds.indexOf(current);
    for (let s = 1; s < team.userIds.length; s++) {
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
      if (i === winner && !this.rule('alwaysRotate') && this.users[d] && this.users[d].status !== Status.Disconnected) return d;
      return this.nextDrawer(i, d);
    });
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

  advance() {
    const last = this.currentRound;
    if (!last) return;
    this.clearChooserTimer();
    const rounds = [...this.previousRounds, last];
    const index = rounds.length;
    const drawers = this.computeNextDrawers(last);
    if (index >= this.settings.numRounds) return this.startFinalRound(rounds, drawers);
    const winner = roundWinner(last, this.fz);
    const streak = this.streakFor(rounds, drawers);
    const hsBase = this.rule('headStartBase');
    const headStart = streak < 2 || hsBase <= 0 ? 0 : hsBase + (streak - 2) * this.rule('headStartStep');
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
    for (const t of this.lobbyTimers.values()) clearTimeout(t);
    for (const set of this.sockets.values()) set.forEach((ws) => ws.close(1000));
    this.spectators.forEach((ws) => ws.close(1000));
  }
}

export { clone, wordListExists, getWordListMeta };
