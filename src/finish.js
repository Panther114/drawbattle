// Saving a played game into this browser's stats and player score. Shared by the live game page and by
// recoverGames(), so a game is stored identically whichever way it is found.
import { recordGame, recordRound } from './stats.js';
import { buildFacts, recordMatch } from './rating.js';
import { applyRules, rules, roundScores, roundWinner, teamPerformance, totalScores } from './shared.js';

// run fn with the rules a game was played with (they change what a round is worth), then put the current ones back
export function withRulesOf(game, fn) {
  const before = { ...rules };
  applyRules(game.settings);
  try {
    return fn();
  } finally {
    applyRules(before);
  }
}

export function recordRoundOf(key, idx, rounds, teamIndex, userId) {
  const r = rounds[idx];
  if (teamIndex < 0 || !r || r.word === undefined) return;
  const scores = roundScores(r);
  recordRound(key, idx, r.teamStates[teamIndex].drawerId === userId ? 'd' : 'g', roundWinner(r) === teamIndex, scores[teamIndex] - scores[1 - teamIndex]);
}

// who was in the game, by team: 0 = mine, 1 = the other side; and where I am in that list
function playersOf(g, teamIndex) {
  return g.teams.flatMap((t, i) => t.userIds.map((id) => [g.users[id]?.name || 'anonymous', i === teamIndex ? 0 : 1]));
}
const placeOf = (g, userId) => g.teams.flatMap((t) => t.userIds).indexOf(userId);

// every round and the result of a finished game, for the player `userId`; `rate: false` skips the player score
export function recordFinishedGame(g, key, userId, { rate = true } = {}) {
  const teamIndex = g.teams.findIndex((t) => t.userIds.includes(userId));
  if (teamIndex < 0 || g.previousRounds.length === 0) return false;
  g.previousRounds.forEach((_, i) => recordRoundOf(key, i, g.previousRounds, teamIndex, userId));
  const totals = totalScores(g.previousRounds, g.finalRound);
  const mine = totals[teamIndex];
  const theirs = totals[1 - teamIndex];
  const mark = teamPerformance(g.previousRounds, teamIndex, g.settings.roundLengthSec)?.mark;
  recordGame(key, mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw', mine, theirs, mark, playersOf(g, teamIndex), placeOf(g, userId));
  if (rate) recordMatch(buildFacts(g, key), userId);
  return true;
}
