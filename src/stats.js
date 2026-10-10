// Personal statistics, kept only in this browser (localStorage). Nothing is sent to the server.
import { reactive } from 'vue';
import { safeStorage } from './storage.js';
import { score } from './rating.js';
import { markFor } from './shared.js';

const KEY = 'drawbattle.stats.v1';
const MAX_GAMES = 300;
const storage = safeStorage('local');

// games: [{ k: game key, t: first seen (ms), r: [[roundIndex, 'd' | 'g', won 0/1, points gained - points lost]], done, result: 'win' | 'loss' | 'draw', mine, theirs (the final scores of my team and the other), mark, players: [[name, 0 my team | 1 other team]], me: my place in players }]
// (players only for games saved since they were added, me only since after that)
function load() {
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (parsed && Array.isArray(parsed.games)) return parsed.games.filter((g) => g && typeof g.k === 'string' && Array.isArray(g.r) && !g.recovered); // `recovered` entries were guesses from a dropped recovery attempt
  } catch {
    // corrupt data: start over
  }
  return [];
}

export const stats = reactive({ games: load() });

function save() {
  if (stats.games.length > MAX_GAMES) stats.games.splice(0, stats.games.length - MAX_GAMES);
  try {
    storage?.setItem(KEY, JSON.stringify({ games: stats.games }));
  } catch {
    // storage full or blocked: the stats just stay in memory for this visit
  }
}

function entry(key) {
  let g = stats.games.find((x) => x.k === key);
  if (!g) {
    g = { k: key, t: Date.now(), r: [], done: false };
    stats.games.push(g);
  }
  return g;
}

// one finished round, from the point of view of the local player: role 'd' (drawer) or 'g' (guesser)
export function recordRound(key, roundIndex, role, won, net = 0) {
  const g = entry(key);
  if (g.r.some((x) => x[0] === roundIndex)) return false;
  g.r.push([roundIndex, role === 'd' ? 'd' : 'g', won ? 1 : 0, net]);
  g.r.sort((a, b) => a[0] - b[0]);
  save();
  return true;
}

// a finished game: result is 'win' | 'loss' | 'draw'
export function recordGame(key, result, mine, theirs, mark = undefined, players = undefined, me = undefined) {
  const g = entry(key);
  if (g.done) return false;
  g.done = true;
  g.result = result;
  g.mine = mine;
  g.theirs = theirs;
  g.mark = mark;
  if (players) g.players = players;
  if (Number.isInteger(me)) g.me = me;
  g.t = Date.now();
  save();
  return true;
}

// Games saved before the performance mark existed: estimate it from what this browser kept. The match facts hold the
// speed of every guess my team made (a draw cannot tell the two teams apart, so both are averaged), and the round
// list says how many rounds there were. Missed words count as 0, exactly like in a live game.
function legacyMark(g) {
  const m = score.matches.find((x) => x.k === g.k);
  const me = m?.parts.find((p) => p.id === m.me);
  const rounds = Math.max(g.r.length, ...g.r.map((x) => x[0] + 1));
  if (!me || !Number.isFinite(rounds) || rounds < 1) return undefined;
  const side = me.res === 'd' ? m.parts : m.parts.filter((p) => p.res === me.res);
  let sum = 0;
  for (const p of side) for (const [role, , s] of p.rounds) if (role === 'g') sum += 0.3 + 0.7 * s;
  return markFor(sum / (rounds * (me.res === 'd' ? 2 : 1)));
}
export function backfillMarks() {
  let changed = false;
  for (const g of stats.games) {
    if (!g.done || g.mark) continue;
    const mark = legacyMark(g);
    if (mark) {
      g.mark = mark;
      changed = true;
    }
  }
  if (changed) save();
}
backfillMarks();

export function resetStats() {
  stats.games.splice(0, stats.games.length);
  save();
}

// The two teams of a finished game for one line: the winners first, then the losers (a draw keeps my team first).
// side: { tone: 'win' | 'lose' | 'tie', players: [{ name, me }] }. Undefined when the players were not kept.
// Games saved before I was marked: I am the one on my team who goes by the name saved on this device, if that is unambiguous.
export function matchup(g, savedName = '') {
  if (!Array.isArray(g.players) || g.players.length === 0) return undefined;
  const all = g.players.map(([name, side], i) => ({ name, side, i }));
  let me = Number.isInteger(g.me) ? g.me : -1;
  if (me < 0 && savedName) {
    const same = all.filter((p) => p.side === 0 && p.name.trim().toLowerCase() === savedName.trim().toLowerCase());
    if (same.length === 1) me = same[0].i;
  }
  const team = (side) => all.filter((p) => p.side === side).map((p) => ({ name: p.name, me: p.i === me }));
  const mine = team(0);
  const theirs = team(1);
  if (g.result === 'win') return [{ tone: 'win', players: mine }, { tone: 'lose', players: theirs }];
  if (g.result === 'loss') return [{ tone: 'win', players: theirs }, { tone: 'lose', players: mine }];
  return [{ tone: 'tie', players: mine }, { tone: 'tie', players: theirs }];
}

const rate = (won, total) => (total > 0 ? Math.round((won / total) * 100) : undefined);

export function summarize(games = stats.games) {
  const played = games.filter((g) => g.done);
  const won = played.filter((g) => g.result === 'win').length;
  const draws = played.filter((g) => g.result === 'draw').length;
  const rounds = games.flatMap((g) => g.r);
  const as = (role) => {
    const rs = rounds.filter((r) => r[1] === role);
    const w = rs.filter((r) => r[2] === 1).length;
    return { total: rs.length, won: w, rate: rate(w, rs.length) };
  };
  // the average score is what my team ended its games with (`mine`, stored since the very first version);
  // a record without a usable number is left out of it, and the card says how many games it is based on
  const points = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
  const scores = played.map((g) => [points(g.mine), points(g.theirs)]).filter(([m]) => m !== undefined);
  const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : undefined);
  const against = scores.map(([, t]) => t).filter((t) => t !== undefined);
  return {
    played: played.length,
    average: { games: scores.length, mine: mean(scores.map(([m]) => m)), theirs: mean(against) },
    won,
    lost: played.length - won - draws,
    draws,
    winRate: rate(won, played.length),
    drawer: as('d'),
    guesser: as('g'),
    recent: played.slice(-10).reverse(),
  };
}
