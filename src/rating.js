// Player score ("rating"). Everyone starts at 0 and the score can go negative.
//
// Every match moves exactly +100 points in total across the lobby, so one team's gain is always the other
// team's loss (+500 for one side means -400 for the other) and skill decides who gets what:
//
//   raw_i  = guess / draw points over the rounds + the game result bonus
//   delta_i = (raw_i - mean raw) + POT / N - STRENGTH * (rating_i - mean rating)
//
// The first and third terms cancel over the lobby, so the deltas add up to POT; they are rounded with the
// largest-remainder method (ties broken by id) so the whole numbers still add up to exactly POT and every
// client works out the same table without asking the server.
//
// Only raw facts of each match are stored in this browser, never scores: change COEFF and the stored history is
// replayed with the new numbers the next time the page loads.
import { reactive } from 'vue';
import { safeStorage } from './storage.js';
import { drawingStartTime, findCorrectGuess, totalScores } from './shared.js';

export const COEFF = {
  base: 4, // points for a guess / drawing that took the whole round
  span: 16, // extra points for an instant one: full credit is base + span * (1 - time / round length)
  second: 0.5, // credit for the team that guessed second
  win: 50, // game result bonus for every member of the winning team
  draw: 25, // ... and for a drawn game
  pot: 100, // points the whole lobby gains per match
  strength: 0.02, // pull towards the lobby average: a stronger player must out-score the lobby by this much per point
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const round2 = (x) => Math.round(x * 100) / 100;

// full credit for a guess / drawing: s = 1 - (seconds taken / round length)
export function creditFor(rank, s, c = COEFF) {
  return (c.base + c.span * clamp01(s)) * (rank === 1 ? 1 : c.second);
}

// facts of a finished game from the point of view of the final snapshot:
// { k, t, parts: [{ id, r0, res: 'w' | 'd' | 'l', rounds: [[role 'g' | 'd', rank 1 | 2, s]] }] }
export function buildFacts(game, key) {
  const T = Math.max(1, game.settings?.roundLengthSec ?? 60);
  const parts = new Map();
  game.teams.forEach((team, ti) => {
    for (const id of team.userIds) {
      const u = game.users[id];
      parts.set(id, { id, ti, r0: Number.isFinite(u?.rating) ? Math.round(u.rating) : 0, res: 'l', rounds: [] });
    }
  });
  for (const round of game.previousRounds) {
    if (!round || round.word === undefined || round.wordChosenTime === undefined) continue;
    const hits = round.teamStates.map((ts, ti) => {
      const g = findCorrectGuess(ts.guesses, round.word);
      return g ? { g, ti, ts, s: 1 - (g.timestamp - drawingStartTime(round, ti)) / 1000 / T } : undefined;
    });
    const firstTeam = hits.reduce((best, h) => (h && (!best || h.g.timestamp < best.g.timestamp) ? h : best), undefined);
    for (const h of hits) {
      if (!h) continue;
      const rank = h === firstTeam ? 1 : 2;
      const guesser = parts.get(h.g.userId);
      const drawer = parts.get(h.ts.drawerId);
      if (guesser && guesser.ti === h.ti) guesser.rounds.push(['g', rank, round2(clamp01(h.s))]);
      if (drawer && drawer.ti === h.ti) drawer.rounds.push(['d', rank, round2(clamp01(h.s))]);
    }
  }
  if (game.previousRounds.length > 0) {
    const totals = totalScores(game.previousRounds, game.finalRound);
    for (const p of parts.values()) {
      const mine = totals[p.ti];
      const theirs = totals[1 - p.ti];
      p.res = mine > theirs ? 'w' : mine < theirs ? 'l' : 'd';
    }
  }
  return {
    k: key,
    t: Date.now(),
    parts: [...parts.values()].map(({ id, r0, res, rounds }) => ({ id, r0, res, rounds })),
  };
}

// the table of one match: { [id]: { raw, guess, draw, result, delta } }
export function computeMatch(facts, c = COEFF) {
  const parts = [...facts.parts].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const N = parts.length;
  const out = {};
  if (N === 0) return out;
  const rows = parts.map((p) => {
    let guess = 0;
    let draw = 0;
    for (const [role, rank, s] of p.rounds) {
      if (role === 'd') draw += creditFor(rank, s, c);
      else guess += creditFor(rank, s, c);
    }
    const result = p.res === 'w' ? c.win : p.res === 'd' ? c.draw : 0;
    return { id: p.id, r0: p.r0, guess, draw, result, raw: guess + draw + result };
  });
  const meanRaw = rows.reduce((a, r) => a + r.raw, 0) / N;
  const meanR0 = rows.reduce((a, r) => a + r.r0, 0) / N;
  const exact = rows.map((r) => r.raw - meanRaw + c.pot / N - c.strength * (r.r0 - meanR0));
  const floors = exact.map(Math.floor);
  let left = Math.round(c.pot) - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - floors[i] }))
    .sort((a, b) => b.frac - a.frac || (rows[a.i].id < rows[b.i].id ? -1 : 1));
  for (let k = 0; left > 0 && k < order.length; k++, left--) floors[order[k].i] += 1;
  rows.forEach((r, i) => {
    out[r.id] = { raw: round2(r.raw), guess: round2(r.guess), draw: round2(r.draw), result: r.result, delta: floors[i], r0: r.r0 };
  });
  return out;
}

// ---- this browser's history ----
const KEY = 'drawbattle.matches.v1';
const MAX_MATCHES = 200;
const storage = safeStorage('local');

function load() {
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (parsed && Array.isArray(parsed.matches)) {
      return parsed.matches.filter((m) => m && typeof m.k === 'string' && typeof m.me === 'string' && Array.isArray(m.parts));
    }
  } catch {
    // corrupt data: start over
  }
  return [];
}

export const score = reactive({ matches: load(), rating: 0, history: [] });

// replay every stored match with the current coefficients; my own start rating is the running total
export function replay(matches = score.matches, c = COEFF) {
  let rating = 0;
  const history = [];
  for (const m of matches) {
    const facts = { ...m, parts: m.parts.map((p) => (p.id === m.me ? { ...p, r0: rating } : p)) };
    const mine = computeMatch(facts, c)[m.me];
    if (!mine) continue;
    rating += mine.delta;
    history.push({ k: m.k, t: m.t, delta: mine.delta, rating, res: facts.parts.find((p) => p.id === m.me)?.res });
  }
  return { rating, history };
}

function refresh() {
  const r = replay();
  score.rating = r.rating;
  score.history = r.history;
}
refresh();

function save() {
  if (score.matches.length > MAX_MATCHES) score.matches.splice(0, score.matches.length - MAX_MATCHES);
  try {
    storage?.setItem(KEY, JSON.stringify({ matches: score.matches }));
  } catch {
    // storage full or blocked: the history stays in memory for this visit
  }
}

// facts: from buildFacts(); me: the local player's id in that game. Returns the local player's row, once per game.
export function recordMatch(facts, me) {
  if (score.matches.some((m) => m.k === facts.k) || !facts.parts.some((p) => p.id === me)) return undefined;
  score.matches.push({ ...facts, me });
  save();
  refresh();
  return computeMatch(facts)[me];
}

export function resetScore() {
  score.matches.splice(0, score.matches.length);
  save();
  refresh();
}

export const formatDelta = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
