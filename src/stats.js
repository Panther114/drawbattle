// Personal statistics, kept only in this browser (localStorage). Nothing is sent to the server.
import { reactive } from 'vue';
import { safeStorage } from './storage.js';

const KEY = 'drawbattle.stats.v1';
const MAX_GAMES = 300;
const storage = safeStorage('local');

// games: [{ k: game key, t: first seen (ms), r: [[roundIndex, 'd' | 'g', won 0/1]], done, result: 'win' | 'loss' | 'draw', mine, theirs }]
function load() {
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (parsed && Array.isArray(parsed.games)) return parsed.games.filter((g) => g && typeof g.k === 'string' && Array.isArray(g.r));
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
export function recordRound(key, roundIndex, role, won) {
  const g = entry(key);
  if (g.r.some((x) => x[0] === roundIndex)) return false;
  g.r.push([roundIndex, role === 'd' ? 'd' : 'g', won ? 1 : 0]);
  save();
  return true;
}

// a finished game: result is 'win' | 'loss' | 'draw'
export function recordGame(key, result, mine, theirs) {
  const g = entry(key);
  if (g.done) return false;
  g.done = true;
  g.result = result;
  g.mine = mine;
  g.theirs = theirs;
  g.t = Date.now();
  save();
  return true;
}

export function resetStats() {
  stats.games.splice(0, stats.games.length);
  save();
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
  return {
    played: played.length,
    won,
    lost: played.length - won - draws,
    draws,
    winRate: rate(won, played.length),
    drawer: as('d'),
    guesser: as('g'),
    recent: played.slice(-10).reverse(),
  };
}
