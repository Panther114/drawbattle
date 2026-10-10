// Brings back games that were played but never saved (a bug kept the finish from being recorded).
// Every round of such a game is in the stats already, only the result is missing. If the server still has the
// game, the whole save is redone from it; otherwise the result is worked out from the saved rounds.
import { stats, finishRecovered } from './stats.js';
import { API } from './wordpacks.js';
import { isGameEnded, roundWinner } from './shared.js';
import { recordFinishedGame, withRulesOf } from './finish.js';
import { safeStorage } from './storage.js';

const GIVE_UP_MS = 3 * 60 * 60 * 1000; // an unfinished game this old is not coming back
let running = false;

// which player of the game was I? every saved round (role, won) has to fit. Returns [userId, certain]
function whoWasI(g, game) {
  const name = safeStorage('local')?.getItem('userName');
  const fits = game.teams
    .flatMap((t, ti) => t.userIds.map((id) => ({ id, ti })))
    .filter(({ id, ti }) =>
      withRulesOf(game, () =>
        g.r.every(([idx, role, won]) => {
          const r = game.previousRounds[idx];
          return r && r.word !== undefined && (r.teamStates[ti].drawerId === id ? 'd' : 'g') === role && (roundWinner(r) === ti ? 1 : 0) === won;
        }),
      ),
    );
  if (fits.length === 1) return [fits[0].id, true];
  const named = fits.filter((f) => name && game.users[f.id]?.name === name);
  if (named.length === 1) return [named[0].id, true];
  // teammates with the same roles: the game is the same for all of them, only the player score would be a guess
  return fits.length > 0 && fits.every((f) => f.ti === fits[0].ti) ? [fits[0].id, false] : [undefined, false];
}

async function fromServer(g) {
  const res = await fetch(`${API}/games/${g.k.split('-')[0]}?include=guesses`);
  if (res.status !== 200) return false;
  const game = await res.json();
  if (`${game.id}-${game.createdAt ?? 0}` !== g.k || !isGameEnded(game)) return false;
  const [uid, certain] = whoWasI(g, game);
  return uid !== undefined && withRulesOf(game, () => recordFinishedGame(game, g.k, uid, { rate: certain }));
}

export async function recoverGames() {
  if (running) return 0;
  running = true;
  let n = 0;
  try {
    for (const g of [...stats.games]) {
      if (g.done || g.r.length === 0 || !/^[a-z]{4}-\d+$/.test(g.k)) continue;
      let ok = false;
      try {
        ok = await fromServer(g);
      } catch {
        continue; // offline: try again next time
      }
      if (!ok && Date.now() - g.t > GIVE_UP_MS) ok = finishRecovered(g.k);
      if (ok) n += 1;
    }
  } finally {
    running = false;
  }
  return n;
}
