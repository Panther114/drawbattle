// Shared constants and pure helpers (game rules mirrored on the server).

import { reactive } from 'vue';

// ---- per-game rules (customisable in the lobby; every key is optional in game.settings) ----
export const DEFAULT_RULES = {
  chooseWordSec: 15, // time the chooser has to pick a word
  wordChoiceCount: 2, // words offered to the chooser (2-4)
  startCountdownSec: 5, // lobby countdown before round 1
  drawingCountdownSec: 3, // pause between choosing and drawing
  roundEndSec: 5, // pause on the result screen after a round
  pointsWin: 200, // points for guessing first
  pointsCorrect: 100, // points for guessing second
  finalWordPoints: 100, // final round: points per word
  finalBonusPoints: 100, // final round: bonus for finishing every word
  headStartBase: 3, // head start (s) at a 2-win streak (0 = no head starts)
  headStartStep: 1, // extra head start per additional win
  finalWordDelaySec: 2, // final round: pause before the next word
  hintIntervalSec: 0, // reveal one letter to guessers every N seconds (0 = off)
  palette: 'full', // full | basic | mono
  allowEraser: true,
  allowClear: true,
  fuzzyMatch: false, // accept guesses with one typo (words of 6+ letters)
  maxTeamSize: 8,
  alwaysRotate: false, // the drawer always rotates, even after winning
  allowSpectators: true,
  allowLateJoin: true,
  lateJoinPickTeam: false, // someone joining a game in progress picks their team (off: the smaller team)
  singleWordsOnly: false, // only offer words without spaces
  maxWordLength: 0, // only offer words up to this many characters (0 = any)
  finalDrawdown: true, // play the final drawdown after the last round (off: the game ends after the last round)
};
// rules shown right in the lobby settings (not in the "customize rules" dialog)
export const LOBBY_RULES = ['alwaysRotate', 'allowLateJoin', 'lateJoinPickTeam'];
export const rules = reactive({ ...DEFAULT_RULES });
export function applyRules(settings) {
  for (const k of Object.keys(DEFAULT_RULES)) {
    const v = settings ? settings[k] : undefined;
    rules[k] = v === undefined || v === null || typeof v !== typeof DEFAULT_RULES[k] ? DEFAULT_RULES[k] : v;
  }
}
export const PALETTES = {
  full: ['000000', 'd0d0d0', 'ffc7eb', 'ed120e', 'ff6504', 'ffe006', '07c504', '00a9ff', '9905b1', '964828'],
  basic: ['000000', 'ed120e', 'ffe006', '07c504', '00a9ff'],
  mono: ['000000', '808080', 'd0d0d0'],
};

// ---- timing (seconds) ----
export const CHOOSE_WORD_SEC = 15;
export const DRAWING_COUNTDOWN_SEC = 3;
export const DRAWING_END_SEC = 5;
export const FINAL_PRE_START_SEC = 11;
export const FINAL_START_COUNTDOWN_SEC = 3;
export const HEAD_START_BASE_SEC = 3;
export const HEAD_START_STEP_SEC = 1;
export const MAX_TEAM_SIZE = 8;
export const MAX_GUESS_LENGTH = 36;
export const MAX_NAME_LENGTH = 16;
export const MAX_CHAT_LENGTH = 140;

// strictly more than half of the voters (7 players -> 6 voters -> 4 votes)
export const voteThreshold = (voters) => Math.floor(voters / 2) + 1;

// usernames never contain control characters or a "(you)" look-alike (the lobby adds its own "(you)" tag)
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
const YOU_TAG = /\(\s*y\s*o\s*u\s*\)/gi;
// live typing: strip only the forbidden tag (no trimming, so spaces can still be typed)
export function containsYouTag(raw) {
  return typeof raw === 'string' && /\(\s*y\s*o\s*u\s*\)/i.test(raw.normalize('NFKC').replace(INVISIBLE, ''));
}
export function cleanNameInput(raw) {
  let n = raw.normalize('NFKC').replace(INVISIBLE, '');
  for (let prev = ''; prev !== n; ) {
    prev = n;
    n = n.replace(YOU_TAG, '');
  }
  return n;
}
export function sanitizeName(raw) {
  if (typeof raw !== 'string') return '';
  let n = raw.normalize('NFKC').replace(INVISIBLE, '');
  for (let prev = ''; prev !== n; ) {
    prev = n;
    n = n.replace(YOU_TAG, '');
  }
  return Array.from(n.replace(/\s+/g, ' ').trim()).slice(0, MAX_NAME_LENGTH).join('').trim();
}

// ---- enums ----
export const UserStatus = { Connected: 1, Disconnected: 2, Kicked: 3 };
// what a connected player is up to: here, in another window, or behind Quick Switch
export const UserPresence = { Active: 0, Away: 1, Snooze: 2 };

export const RoundStage = {
  ChooseWord: 0,
  DrawingCountdown: 1,
  DrawingHeadStart: 2,
  Drawing: 3,
  DrawingEnd: 4,
  ScoreScreen: 5,
};

export const FinalRoundStage = {
  PreStartCountdown: 0,
  StartCountdown: 1,
  InProgress: 2,
  RoundEnd: 3,
  SummaryScreen: 4,
};

export const MessageKind = { Drawer: 0, Guessers: 1, Guess: 2 };

export const Sound = {
  BeepLow: 0,
  BeepHigh: 1,
  CorrectGuess: 2,
  OtherTeamCorrectGuess: 3,
  ClockTick: 4,
  Buzzer: 5,
  ScoreTally: 6,
  Confetti: 7,
  Fanfare: 8,
};

export const JoinStatus = {
  Kicked: 'Kicked',
  Nonexistent: 'Nonexistent',
  Started: 'Started',
  AvailableSpot: 'AvailableSpot',
  AvailableDisconnectedSpot: 'AvailableDisconnectedSpot',
  LateJoin: 'LateJoin',
  Full: 'Full',
  Ended: 'Ended',
  Closed: 'Closed',
};

// server -> client
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

// client -> server
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

// canvas operations
export const Op = {
  PathStart: 201,
  PathMove: 202,
  PathEnd: 203,
  ChangeColor: 204,
  ClearCanvas: 205,
  ChangeTool: 206,
  ChangeStrokeWidth: 207,
};

// ---- guess matching ----
function stripAccents(s) {
  return /[가-힯]/.test(s) ? s : s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function redactWord(word) {
  return stripAccents(word).replace(/[\w一-鿿㐀-䶿가-힯ß]/g, '_');
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

export function guessMatches(guess, word) {
  if (!word) return false;
  const g = normalizeGuess(guess);
  const w = normalizeGuess(word);
  if (g === w) return true;
  return rules.fuzzyMatch && w.length >= 6 && g.length > 0 && withinOneEdit(g, w);
}

// word shown to guessers: underscores, with letters revealed over time when hints are on
export function hintedWord(word, revealed) {
  const base = redactWord(word);
  if (revealed <= 0) return base;
  const chars = [...stripAccents(word)];
  const positions = [];
  chars.forEach((c, i) => {
    if (base[i] === '_') positions.push(i);
  });
  // deterministic shuffle seeded by the word so every viewer reveals the same letters
  let seed = 0;
  for (const c of word) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  const out = [...base];
  const max = Math.min(revealed, Math.floor(positions.length / 2));
  for (let k = 0; k < max; k++) out[positions[k]] = chars[positions[k]];
  return out.join('');
}

export function findCorrectGuess(guesses, word) {
  for (const g of guesses) if (guessMatches(g.guess, word)) return g;
  return undefined;
}

// index of the team with the earliest correct guess
export function roundWinner(round) {
  let best;
  let team;
  round.teamStates.forEach((ts, i) => {
    const g = findCorrectGuess(ts.guesses, round.word);
    if (g && (!best || g.timestamp < best.timestamp)) {
      best = g;
      team = i;
    }
  });
  return team;
}

// number of consecutive wins by the drawer who is about to draw again
export function winStreak(rounds, nextDrawers) {
  if (rules.alwaysRotate) return 0;
  if (rounds.length === 0) return 0;
  const last = rounds[rounds.length - 1];
  const w = roundWinner(last);
  if (w === undefined) return 0;
  const drawer = last.teamStates[w].drawerId;
  if (nextDrawers[w] !== drawer) return 0;
  let s = 1;
  for (let i = rounds.length - 2; i >= 0; i--) {
    const rw = roundWinner(rounds[i]);
    if (rw !== w || rounds[i].teamStates[rw].drawerId !== drawer) break;
    s += 1;
  }
  return s;
}

export function headStartForStreak(streak) {
  return streak < 2 || rules.headStartBase <= 0 ? 0 : rules.headStartBase + (streak - 2) * rules.headStartStep;
}

// per-team result of a round
export function roundResults(round) {
  let earliest = Number.MAX_VALUE;
  let winner = -1;
  const times = [];
  round.teamStates.forEach((ts, i) => {
    const g = findCorrectGuess(ts.guesses, round.word);
    if (g) {
      times[i] = g.timestamp;
      if (g.timestamp < earliest) {
        earliest = g.timestamp;
        winner = i;
      }
    }
  });
  return round.teamStates.map((_, i) => {
    const didWin = i === winner;
    return {
      didWin,
      score: didWin ? rules.pointsWin : times[i] !== undefined ? rules.pointsCorrect : 0,
      timeDifferential:
        times[i] !== undefined && times[1 - i] !== undefined ? Math.abs(times[i] - times[1 - i]) : undefined,
    };
  });
}

export const roundScores = (round) => roundResults(round).map((r) => r.score);

// number of final-round words a team has completed
export function finalWordsDone(finalRound, teamIndex) {
  const states = finalRound.teamStates[teamIndex];
  const last = states.length - 1;
  return findCorrectGuess(states[last].guesses, finalRound.words[last]) === undefined ? last : last + 1;
}

export function finalRoundScores(finalRound) {
  return finalRound.teamStates.map((_, t) => {
    const done = finalWordsDone(finalRound, t);
    let s = rules.finalWordPoints * done;
    if (done === finalRound.words.length) s += rules.finalBonusPoints;
    return s;
  });
}

export function totalScores(previousRounds, finalRound) {
  // a game ended before its first round was scored has no rounds at all
  const teams = finalRound ? finalRound.teamStates.length : previousRounds[0] ? previousRounds[0].teamStates.length : 2;
  let t = previousRounds.map((r) => roundScores(r)).reduce((a, b) => a.map((x, i) => x + b[i]), Array(teams).fill(0));
  if (finalRound) {
    const f = finalRoundScores(finalRound);
    t = t.map((x, i) => x + f[i]);
  }
  return t;
}

// [teamIndex, timestamp] of the team that finished the final round first
export function finalRoundWinner(finalRound) {
  let team;
  let time;
  finalRound.teamStates.forEach((states, i) => {
    if (states.length === finalRound.words.length) {
      const g = findCorrectGuess(states[finalRound.words.length - 1].guesses, finalRound.words[finalRound.words.length - 1]);
      if (g !== undefined && (time === undefined || g.timestamp < time)) {
        team = i;
        time = g.timestamp;
      }
    }
  });
  if (team !== undefined && time !== undefined) return [team, time];
  return undefined;
}

export const isGameEnded = (game) =>
  game.ended === true || (game.finalRound !== undefined && finalRoundWinner(game.finalRound) !== undefined);

// next connected teammate after `current` (wrapping), or `current` if alone
export function nextDrawer(team, users, current) {
  const n = team.userIds.indexOf(current);
  // a drawer who left the team (kicked / switched) is not in the list, so every member is a candidate
  const tries = n < 0 ? team.userIds.length : team.userIds.length - 1;
  for (let s = 1; s <= tries; s++) {
    const id = team.userIds[(n + s) % team.userIds.length];
    if (users[id].status !== UserStatus.Disconnected) return id;
  }
  return current;
}

// all connected users ready and every team has 2+ connected users
export function canAutoStartNext(readyIds, teams, users) {
  for (const id in users) {
    const u = users[id];
    if (u.status === UserStatus.Connected && !readyIds.includes(u.id)) return false;
  }
  for (const t of teams) {
    if (t.userIds.filter((id) => users[id].status === UserStatus.Connected).length < 2) return false;
  }
  return true;
}

export const displayName = (user) => user.name || 'anonymous';

// latest timestamp at which both teams have guessed, if they both have
export function bothGuessedTime(round) {
  let latest;
  for (const ts of round.teamStates) {
    const g = findCorrectGuess(ts.guesses, round.word);
    if (!g) return undefined;
    if (latest === undefined || g.timestamp > latest) latest = g.timestamp;
  }
  return latest;
}

// ms at which a team may start drawing
export function drawingStartTime(round, teamIndex) {
  return (
    round.wordChosenTime +
    rules.drawingCountdownSec * 1000 +
    (round.chooserId !== round.teamStates[teamIndex].drawerId ? round.chooserHeadStartSeconds * 1000 : 0)
  );
}

// build the event list shown in a message log
export function buildMessages(drawer, word, guesses, startTime, kinds) {
  const out = [];
  for (const k of kinds) {
    if (k === MessageKind.Drawer || k === MessageKind.Guessers) out.push({ type: k, drawer });
  }
  for (const g of guesses) {
    out.push({
      type: MessageKind.Guess,
      guess: g,
      isCorrect: guessMatches(g.guess, word),
      msElapsed: g.timestamp - startTime,
    });
  }
  return out;
}

export function isIOS() {
  return (
    ['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(navigator.platform) ||
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
  );
}

export function isUnavailableJoinStatus(s) {
  return (
    s === JoinStatus.AvailableSpot ||
    s === JoinStatus.AvailableDisconnectedSpot ||
    s === JoinStatus.LateJoin ||
    s === JoinStatus.Ended
  );
}

export function formatClock(totalSeconds) {
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
}
