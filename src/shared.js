// Shared constants and pure helpers (game rules mirrored on the server).

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

// ---- enums ----
export const UserStatus = { Connected: 1, Disconnected: 2 };

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
  Nonexistent: 'Nonexistent',
  Started: 'Started',
  AvailableSpot: 'AvailableSpot',
  AvailableDisconnectedSpot: 'AvailableDisconnectedSpot',
  Full: 'Full',
  Ended: 'Ended',
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

export function guessMatches(guess, word) {
  return !!word && normalizeGuess(guess) === normalizeGuess(word);
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
  return streak < 2 ? 0 : HEAD_START_BASE_SEC + (streak - 2) * HEAD_START_STEP_SEC;
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
      score: didWin ? 200 : times[i] !== undefined ? 100 : 0,
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
    let s = 100 * done;
    if (done === finalRound.words.length) s += 100;
    return s;
  });
}

export function totalScores(previousRounds, finalRound) {
  let t = previousRounds.map((r) => roundScores(r)).reduce((a, b) => a.map((x, i) => x + b[i]));
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

export const isGameEnded = (game) => game.finalRound !== undefined && finalRoundWinner(game.finalRound) !== undefined;

// next connected teammate after `current` (wrapping), or `current` if alone
export function nextDrawer(team, users, current) {
  const n = team.userIds.indexOf(current);
  for (let s = 1; s < team.userIds.length; s++) {
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
    DRAWING_COUNTDOWN_SEC * 1000 +
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
  return s === JoinStatus.AvailableSpot || s === JoinStatus.AvailableDisconnectedSpot || s === JoinStatus.Ended;
}

export function formatClock(totalSeconds) {
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
}
