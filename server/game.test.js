import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, C, S, Status, sanitizeRating, sanitizeName, voteThreshold, isStale, IDLE_MS, EMPTY_MS, LIVE_IDLE_MS } from './game.js';
import { addCustomPack, shareGlobal, globalListJson, getWordListMeta } from './wordpacks.js';

// ---- helpers ----
class MockWs {
  constructor(game) {
    this.game = game;
    this.readyState = 1;
    this.sent = [];
    this.closed = false;
  }
  send(data) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.readyState = 3;
    this.game.disconnect(this); // the real server does this from the socket's close event
  }
  got(type) {
    return this.sent.filter((m) => m[0] === type);
  }
  last(type) {
    return this.got(type).at(-1);
  }
}

const games = [];
function makeGame(settings = {}) {
  const g = new Game('test', {});
  g.settings = { ...g.settings, ...settings };
  games.push(g);
  return g;
}
test.afterEach(() => {
  while (games.length) games.pop().destroy();
});

function join(g, id, name = id) {
  const ws = new MockWs(g);
  g.connect(ws, { userId: id, userName: name });
  return ws;
}
function send(g, ws, ...msg) {
  g.handleMessage(ws, JSON.stringify(msg));
}
// n players, split across the two teams; returns { ws: {id: MockWs} }
function lobby(g, n) {
  const ws = {};
  for (let i = 1; i <= n; i++) ws[`p${i}`] = join(g, `p${i}`);
  return ws;
}
const ids = (g, ti) => g.teams[ti].userIds;

// starts the game and fast-forwards to the score screen of the current round
function startGame(g, ws) {
  g.onStartGame();
  assert.ok(g.currentRound, 'game started');
}
function toDrawing(g) {
  const r = g.currentRound;
  r.startTime = g.now() - 60_000;
  r.word = r.wordChoices[0];
  r.wordChosenTime = g.now() - 20_000;
  g.chosenByTeam = g.teamIndexOfDrawer(r, r.chooserId);
}
function toScoreScreen(g) {
  const r = g.currentRound;
  r.startTime = g.now() - 20 * 60_000;
  r.word = r.word ?? r.wordChoices[0];
  r.wordChosenTime = g.now() - 15 * 60_000;
  assert.ok(g.inScoreScreen(), 'in score screen');
}

// ---- usernames ----
test('sanitizeName strips every "(you)" variant', () => {
  assert.equal(sanitizeName('Bob (you)'), 'Bob');
  assert.equal(sanitizeName('(YOU)'), '');
  assert.equal(sanitizeName('( y o u )x'), 'x');
  assert.equal(sanitizeName('（you）'), ''); // full-width parentheses
  assert.equal(sanitizeName('(y​ou)ok'), 'ok'); // zero-width char inside
  assert.equal(sanitizeName('(y(you)ou)'), ''); // nested: removing the inner tag must not leave a new one
  assert.equal(sanitizeName('a\u0000b\tc'), 'abc'); // control characters are dropped
  assert.ok(!/\(\s*you\s*\)/i.test(sanitizeName('x(you)(you)(yo(you)u)y')));
  assert.equal(sanitizeName('  hi   there  '), 'hi there');
  assert.equal(sanitizeName('abcdefghijklmnopqrst'), 'abcdefghijklmnop'); // 16 max
  assert.equal(sanitizeName(5), '');
});

test('server applies the name filter on join and rename', () => {
  const g = makeGame();
  const a = join(g, 'a', 'Al (you)');
  assert.equal(g.users.a.name, 'Al');
  send(g, a, C.UpdateUserName, 'Al(YOU)');
  assert.equal(g.users.a.name, 'Al');
  send(g, a, C.UpdateUserName, '(you)');
  assert.equal(g.users.a.name, '');
  const b = new MockWs(g);
  g.connect(b, { userId: 'b', userName: 'Q( you )' });
  assert.equal(g.users.b.name, 'Q');
});

// ---- vote kick ----
test('vote threshold is strictly more than half', () => {
  assert.equal(voteThreshold(6), 4); // 7 players -> 6 voters -> 4 votes
  assert.equal(voteThreshold(7), 4);
  assert.equal(voteThreshold(2), 2);
  assert.equal(voteThreshold(3), 2);
  assert.equal(voteThreshold(1), 1);
});

test('vote kick: 7 players need 4 of the 6 other players', () => {
  const g = makeGame();
  const ws = lobby(g, 7);
  const target = 'p7';
  for (const v of ['p1', 'p2', 'p3']) send(g, ws[v], C.VoteKick, target);
  assert.ok(g.users[target], '3 of 6 is not enough');
  assert.deepEqual(g.kickVotes.get(target).size, 3);
  send(g, ws.p4, C.VoteKick, target);
  assert.equal(g.users[target], undefined, 'removed from the lobby');
  assert.ok(!g.teams.some((t) => t.userIds.includes(target)));
  assert.ok(ws.p7.closed);
  assert.equal(ws.p7.got(S.ServerError)[0][1].type, 'Kicked');
  assert.equal(ws.p1.last(S.UserKicked)[1], target);
  assert.equal(g.kickVotes.size, 0);
});

test('vote kick: 8 players need 4 of the 7 others; 5 need 3 of 4', () => {
  let g = makeGame();
  let ws = lobby(g, 8);
  for (const v of ['p1', 'p2', 'p3']) send(g, ws[v], C.VoteKick, 'p8');
  assert.ok(g.users.p8);
  send(g, ws.p4, C.VoteKick, 'p8');
  assert.equal(g.users.p8, undefined);
  g = makeGame();
  ws = lobby(g, 5);
  send(g, ws.p1, C.VoteKick, 'p5');
  send(g, ws.p2, C.VoteKick, 'p5');
  assert.ok(g.users.p5, '2 of 4 is exactly half: not enough');
  send(g, ws.p3, C.VoteKick, 'p5');
  assert.equal(g.users.p5, undefined);
});

test('vote kick: voting twice retracts, you cannot vote on yourself, banned users cannot rejoin', () => {
  const g = makeGame();
  const ws = lobby(g, 5);
  send(g, ws.p1, C.VoteKick, 'p5');
  send(g, ws.p1, C.VoteKick, 'p5');
  assert.equal(g.kickVotes.size, 0);
  send(g, ws.p5, C.VoteKick, 'p5');
  assert.equal(g.kickVotes.size, 0);
  for (const v of ['p1', 'p2', 'p3']) send(g, ws[v], C.VoteKick, 'p5');
  assert.equal(g.users.p5, undefined);
  const again = join(g, 'p5', 'p5');
  assert.ok(again.closed);
  assert.equal(again.got(S.ServerError)[0][1].type, 'Kicked');
  assert.equal(g.users.p5, undefined);
});

test('vote kick needs 3 active players, never removes a lone team member, ignores spectators and unknown ids', () => {
  const g = makeGame();
  const ws = lobby(g, 2);
  send(g, ws.p1, C.VoteKick, 'p2');
  assert.equal(g.kickVotes.size, 0, 'only two players');
  const g2 = makeGame();
  const w2 = lobby(g2, 3); // teams 2 + 1
  const loner = g2.teams.find((t) => t.userIds.length === 1).userIds[0];
  const other = ['p1', 'p2', 'p3'].find((p) => p !== loner);
  send(g2, w2[other], C.VoteKick, loner);
  assert.equal(g2.kickVotes.size, 0, 'a team of one cannot lose its player');
  send(g2, w2[other], C.VoteKick, 'nobody');
  send(g2, w2[other], C.VoteKick, 42);
  assert.equal(g2.kickVotes.size, 0);
  const spec = new MockWs(g2);
  g2.connect(spec, { userId: 'spec', spectate: true });
  send(g2, spec, C.VoteKick, 'p1');
  assert.equal(g2.kickVotes.size, 0);
});

test('vote kick: a connection drop never tips an old partial vote over the threshold', () => {
  const g = makeGame();
  const ws = lobby(g, 7);
  for (const v of ['p1', 'p2', 'p3']) send(g, ws[v], C.VoteKick, 'p7');
  startGame(g, ws);
  toDrawing(g);
  ws.p4.close();
  ws.p5.close(); // 4 voters remain (p1,p2,p3,p6) -> 3 would now be enough, but nobody voted
  assert.equal(g.users.p7.status, Status.Connected);
  assert.ok(!ws.p7.closed);
  send(g, ws.p6, C.VoteKick, 'p7'); // a fresh vote evaluates against the current pool
  assert.equal(g.users.p7.status, Status.Kicked);
});

test('vote kick: a team must keep 2 players', () => {
  const g = makeGame();
  const ws = lobby(g, 5); // teams 3 | 2
  for (const v of ['p1', 'p2', 'p3']) send(g, ws[v], C.VoteKick, 'p4');
  assert.equal(g.kickVotes.size, 0, 'a team of 2 cannot lose a player');
  assert.ok(g.users.p4);
});

test('vote kick during the start countdown removes the player completely', () => {
  const g = makeGame();
  const ws = lobby(g, 6);
  startGame(g, ws);
  assert.ok(g.inCountdown);
  for (const v of ['p1', 'p2', 'p3', 'p4']) send(g, ws[v], C.VoteKick, 'p6');
  assert.equal(g.users.p6, undefined);
  g.onCancelStart();
  assert.equal(g.userCount, 5);
  assert.ok(!Object.keys(g.users).includes('p6'));
});

test('vote kick mid-game keeps the user on record (status kicked) but off the teams', () => {
  const g = makeGame();
  const ws = lobby(g, 5);
  startGame(g, ws);
  toDrawing(g);
  const victim = ids(g, 0).find((id) => id !== g.currentRound.teamStates[0].drawerId);
  for (const v of ['p1', 'p2', 'p3', 'p4', 'p5'].filter((p) => p !== victim).slice(0, 3)) send(g, ws[v], C.VoteKick, victim);
  assert.equal(g.users[victim].status, Status.Kicked);
  assert.ok(g.users[victim].name);
  assert.ok(!g.teams.some((t) => t.userIds.includes(victim)));
  assert.equal(g.snapshot().users[victim].status, Status.Kicked);
  // a kicked user's messages are ignored and reconnecting is refused
  send(g, ws[victim], C.Chat, 'hello');
  assert.ok(!g.chat.some((m) => m.userId === victim));
  assert.ok(join(g, victim, 'x').closed);
});

test('kicking the drawer rotates the drawer (and the chooser) and wipes the canvas', () => {
  const g = makeGame();
  const ws = lobby(g, 6);
  startGame(g, ws);
  toDrawing(g);
  const r = g.currentRound;
  const ti = g.teamIndexOf(r.chooserId);
  const victim = r.chooserId;
  const mates = ids(g, ti).filter((id) => id !== victim);
  r.teamStates[ti].canvasOperations.push([201, [0.1, 0.1]]);
  const voters = Object.keys(ws).filter((id) => id !== victim);
  for (const v of voters.slice(0, 4)) send(g, ws[v], C.VoteKick, victim);
  assert.equal(g.users[victim].status, Status.Kicked);
  const nd = r.teamStates[ti].drawerId;
  assert.notEqual(nd, victim);
  assert.ok(mates.includes(nd), 'a teammate takes over');
  assert.equal(r.chooserId, nd, 'chooser follows the drawer');
  const rot = ws[voters[0]].last(S.DrawerRotated);
  assert.deepEqual(rot.slice(1), [0, ti, nd, nd]);
  const ops = r.teamStates[ti].canvasOperations;
  assert.deepEqual(ops.slice(1, 5).map((o) => o[0]), [205, 206, 204, 207]);
  // the other team's drawer is untouched
  assert.equal(ids(g, 1 - ti).includes(r.teamStates[1 - ti].drawerId), true);
});

test('kicking a drawer skips disconnected teammates; only-connected-is-victim falls back to a teammate', () => {
  const g = makeGame();
  const ws = lobby(g, 6); // 3 + 3
  startGame(g, ws);
  toDrawing(g);
  const r = g.currentRound;
  const ti = 0;
  const victim = r.teamStates[ti].drawerId;
  const mates = ids(g, ti).filter((id) => id !== victim);
  ws[mates[0]].close(); // first teammate in line is offline
  for (const v of Object.keys(ws).filter((id) => id !== victim && id !== mates[0]).slice(0, 4)) send(g, ws[v], C.VoteKick, victim);
  assert.equal(g.users[victim].status, Status.Kicked);
  assert.equal(r.teamStates[ti].drawerId, mates[1], 'next active teammate');
});

test('kicking a non-drawer or kicking during the score screen does not touch the drawers', () => {
  const g = makeGame();
  const ws = lobby(g, 6);
  startGame(g, ws);
  toScoreScreen(g);
  const r = g.currentRound;
  const before = r.teamStates.map((t) => t.drawerId);
  const victim = before[0];
  for (const v of Object.keys(ws).filter((id) => id !== victim).slice(0, 4)) send(g, ws[v], C.VoteKick, victim);
  assert.equal(g.users[victim].status, Status.Kicked);
  assert.deepEqual(r.teamStates.map((t) => t.drawerId), before, 'history untouched');
  assert.equal(ws.p1.got(S.DrawerRotated).length, 0);
  // the next round never uses the kicked player
  const drawers = g.computeNextDrawers(r);
  assert.ok(!drawers.includes(victim));
  assert.ok(drawers.every((d, i) => ids(g, i).includes(d)));
});

test('kicking the final-round drawer rotates the drawer of the current word', () => {
  const g = makeGame({ numRounds: 1 });
  const ws = lobby(g, 6);
  startGame(g, ws);
  toScoreScreen(g);
  g.advance();
  assert.ok(g.finalRound, 'final drawdown started');
  const st = g.finalRound.teamStates[0][0];
  const victim = st.drawerId;
  for (const v of Object.keys(ws).filter((id) => id !== victim).slice(0, 4)) send(g, ws[v], C.VoteKick, victim);
  assert.notEqual(st.drawerId, victim);
  assert.deepEqual(ws.p1.last(S.DrawerRotated).slice(1, 4), [[0], 0, st.drawerId]);
  assert.ok(ids(g, 0).includes(st.drawerId));
});

test('vote kick never wedges the round: a kick can complete "everyone is ready"', () => {
  const g = makeGame();
  const ws = lobby(g, 6);
  startGame(g, ws);
  toScoreScreen(g);
  const stuck = 'p6';
  for (const id of Object.keys(ws)) if (id !== stuck) send(g, ws[id], C.ReadyUp, 0);
  // p6 never readied; votes to kick them make the rest "all ready" -> next round starts
  assert.equal(g.previousRounds.length, 0);
  // team 1 has p2,p4,p6 -> after the kick 2 remain, still >= 2
  for (const v of ['p1', 'p2', 'p3', 'p4']) send(g, ws[v], C.VoteKick, stuck);
  assert.equal(g.previousRounds.length, 1, 'advanced to round 2');
});

// ---- forced start ----
test('forced start rotates an inactive (not ready) drawer to the next active teammate', () => {
  const g = makeGame({ numRounds: 5 });
  const ws = lobby(g, 6);
  startGame(g, ws);
  toScoreScreen(g);
  // make team 0 the winner so its drawer would normally stay
  const r = g.currentRound;
  r.teamStates[0].guesses.push({ userId: 'x', guess: r.word, timestamp: Date.now() - 600_000 });
  const stay = r.teamStates[0].drawerId;
  const mates = ids(g, 0).filter((id) => id !== stay);
  const afkNext = r.teamStates[1].drawerId; // loser's drawer is replaced by the next teammate...
  // only mates[1] and the forcer (a team 1 member) are ready; the winner (AFK) must not draw
  const forcer = ids(g, 1)[0];
  send(g, ws[mates[1]], C.ReadyUp, 0);
  send(g, ws[forcer], C.ForceStartNextRound, 0);
  assert.equal(g.previousRounds.length, 1, 'next round started');
  const next = g.currentRound.teamStates.map((t) => t.drawerId);
  assert.equal(next[0], mates[1], 'AFK winner replaced by the next active teammate');
  assert.ok(g.ready.size === 0);
  void afkNext;
});

test('forced start skips an unready planned drawer on the losing team too, keeps them if nobody is ready', () => {
  const g = makeGame({ numRounds: 5 });
  const ws = lobby(g, 6);
  startGame(g, ws);
  toScoreScreen(g);
  const r = g.currentRound;
  const planned = g.computeNextDrawers(r);
  const ready = ids(g, 1).find((id) => id !== planned[1]); // ready teammate, not the planned drawer
  send(g, ws[ready], C.ReadyUp, 0);
  send(g, ws[ids(g, 0)[0]], C.ForceStartNextRound, 0);
  const next = g.currentRound.teamStates.map((t) => t.drawerId);
  assert.equal(next[1], ready);
  // team 0 had only the forcer ready; the forcer takes the pen when the planned drawer is AFK
  assert.equal(next[0], ids(g, 0)[0]);
});

test('a normal (everyone ready) advance does not reshuffle drawers', () => {
  const g = makeGame({ numRounds: 5 });
  const ws = lobby(g, 4);
  startGame(g, ws);
  toScoreScreen(g);
  const planned = g.computeNextDrawers(g.currentRound);
  for (const id of Object.keys(ws)) send(g, ws[id], C.ReadyUp, 0);
  assert.deepEqual(g.currentRound.teamStates.map((t) => t.drawerId), planned);
});

// ---- team switch appeals ----
function threeTwoGame() {
  const g = makeGame({ numRounds: 5 });
  const ws = lobby(g, 5); // teams: p1,p3,p5 | p2,p4
  startGame(g, ws);
  return { g, ws };
}

test('team switch appeal: only between rounds', () => {
  const { g, ws } = threeTwoGame();
  send(g, ws.p5, C.SwitchAppeal);
  assert.equal(g.switchAppeals.size, 0, 'not allowed during the countdown');
  toDrawing(g);
  send(g, ws.p5, C.SwitchAppeal);
  assert.equal(g.switchAppeals.size, 0, 'not allowed while drawing');
  toScoreScreen(g);
  send(g, ws.p5, C.SwitchAppeal);
  assert.equal(g.switchAppeals.size, 1, 'allowed on the score screen');
});

test('team switch appeal needs a team of more than 2 active players', () => {
  const { g, ws } = threeTwoGame();
  toScoreScreen(g);
  send(g, ws.p2, C.SwitchAppeal); // team of 2
  assert.equal(g.switchAppeals.size, 0);
  ws.p3.close(); // team 0 is now 2 active players (+1 offline)
  send(g, ws.p1, C.SwitchAppeal);
  assert.equal(g.switchAppeals.size, 0, 'offline teammates do not count');
});

test('team switch appeal: more than half of the other active players must agree', () => {
  const { g, ws } = threeTwoGame();
  toScoreScreen(g);
  send(g, ws.p5, C.SwitchAppeal);
  assert.ok(g.switchAppeals.has('p5'));
  send(g, ws.p5, C.SwitchVote, 'p5'); // cannot vote for yourself
  assert.equal(g.switchAppeals.get('p5').size, 0);
  send(g, ws.p1, C.SwitchVote, 'p5');
  send(g, ws.p2, C.SwitchVote, 'p5');
  assert.deepEqual(ids(g, 0), ['p1', 'p3', 'p5'], '2 of 4 is not enough');
  send(g, ws.p4, C.SwitchVote, 'p5');
  assert.deepEqual(ids(g, 0), ['p1', 'p3']);
  assert.deepEqual(ids(g, 1), ['p2', 'p4', 'p5']);
  assert.equal(g.switchAppeals.size, 0);
  assert.deepEqual(ws.p1.last(S.UpdateTeams)[1].map((t) => t.userIds), [['p1', 'p3'], ['p2', 'p4', 'p5']]);
  assert.ok(g.chat.some((m) => m.sys && m.text.includes('switched')));
});

test('team switch appeal can be withdrawn, votes can be retracted, and appeals reset when the next round starts', () => {
  const { g, ws } = threeTwoGame();
  toScoreScreen(g);
  send(g, ws.p5, C.SwitchAppeal);
  send(g, ws.p5, C.SwitchAppeal);
  assert.equal(g.switchAppeals.size, 0);
  send(g, ws.p5, C.SwitchAppeal);
  send(g, ws.p1, C.SwitchVote, 'p5');
  send(g, ws.p1, C.SwitchVote, 'p5');
  assert.equal(g.switchAppeals.get('p5').size, 0);
  for (const id of Object.keys(ws)) send(g, ws[id], C.ReadyUp, 0);
  assert.equal(g.previousRounds.length, 1);
  assert.equal(g.switchAppeals.size, 0, 'cleared');
  send(g, ws.p1, C.SwitchVote, 'p5'); // late vote is ignored
  assert.deepEqual(ids(g, 0), ['p1', 'p3', 'p5']);
});

test('team switch appeal respects the max team size', () => {
  const g = makeGame({ numRounds: 5, maxTeamSize: 2 });
  g.settings.maxTeamSize = 2;
  const ws = lobby(g, 4);
  startGame(g, ws);
  toScoreScreen(g);
  send(g, ws.p1, C.SwitchAppeal);
  assert.equal(g.switchAppeals.size, 0, 'team of 2 cannot appeal anyway');
});

test('a switched drawer is not carried into the next round on the wrong team', () => {
  const { g, ws } = threeTwoGame();
  toScoreScreen(g);
  const r = g.currentRound;
  const d = r.teamStates[0].drawerId; // team 0 drawer wins, then switches
  r.teamStates[0].guesses.push({ userId: 'x', guess: r.word, timestamp: Date.now() - 600_000 });
  assert.equal(ids(g, 0).length, 3);
  assert.ok(ids(g, 0).includes(d));
  send(g, ws[d], C.SwitchAppeal);
  for (const v of Object.keys(ws).filter((id) => id !== d)) send(g, ws[v], C.SwitchVote, d);
  assert.ok(ids(g, 1).includes(d));
  const next = g.computeNextDrawers(r);
  assert.ok(ids(g, 0).includes(next[0]), 'drawer of team 0 is still on team 0');
  assert.notEqual(next[0], d);
});

// ---- no final drawdown ----
test('finalDrawdown=false: the game ends after the last round', () => {
  const g = makeGame({ numRounds: 2, finalDrawdown: false });
  const ws = lobby(g, 4);
  startGame(g, ws);
  toScoreScreen(g);
  g.advance();
  assert.equal(g.previousRounds.length, 1);
  assert.ok(g.currentRound);
  toScoreScreen(g);
  const ready = (id) => send(g, ws[id], C.ReadyUp, 1);
  for (const id of Object.keys(ws)) ready(id);
  assert.equal(g.finalRound, undefined, 'no final round');
  assert.equal(g.currentRound, undefined);
  assert.equal(g.ended, true);
  assert.equal(g.finished, true);
  assert.equal(g.previousRounds.length, 2);
  assert.ok(ws.p1.got(S.GameOver).length === 1);
  const snap = g.snapshot('none');
  assert.equal(snap.ended, true);
  assert.equal(snap.previousRounds.length, 2);
  assert.equal(g.started, true, 'cannot be started again');
  assert.equal(g.lobbyInfo().stage, 'ended');
  g.onStartGame();
  assert.equal(g.currentRound, undefined);
});

test('finalDrawdown default (true) still starts the final drawdown', () => {
  const g = makeGame({ numRounds: 1 });
  const ws = lobby(g, 4);
  startGame(g, ws);
  toScoreScreen(g);
  g.advance();
  assert.ok(g.finalRound);
  assert.equal(g.ended, false);
});

test('finalDrawdown=false also works when the last round is force started', () => {
  const g = makeGame({ numRounds: 1, finalDrawdown: false });
  const ws = lobby(g, 4);
  startGame(g, ws);
  toScoreScreen(g);
  send(g, ws.p1, C.ForceStartNextRound, 0);
  assert.equal(g.ended, true);
});

// ---- chat ----
test('chat is global, capped and stored for newcomers', () => {
  const g = makeGame();
  const ws = lobby(g, 3);
  send(g, ws.p1, C.Chat, '  hello   world ');
  const m = ws.p3.last(S.Chat)[1];
  assert.equal(m.text, 'hello world');
  assert.equal(m.userId, 'p1');
  assert.equal(m.name, 'p1');
  send(g, ws.p2, C.Chat, 'x'.repeat(500));
  assert.equal(ws.p1.last(S.Chat)[1].text.length, 140);
  send(g, ws.p2, C.Chat, '   ');
  send(g, ws.p2, C.Chat, 7);
  assert.equal(g.chat.length, 2);
  const late = join(g, 'p4');
  assert.equal(late.last(S.SessionStart)[1].chat.length, 2);
  const spec = new MockWs(g);
  g.connect(spec, { userId: 's', spectate: true });
  assert.equal(spec.last(S.SessionStart)[1].chat.length, 2);
  send(g, spec, C.Chat, 'hi');
  assert.equal(g.chat.length, 3, 'spectators can chat too');
  const sm = g.chat.at(-1);
  assert.equal(sm.spec, true);
  assert.equal(sm.userId, undefined, 'a spectator message never carries a user id');
  send(g, spec, C.StartGame);
  assert.equal(g.started, false, 'but spectators cannot do anything else');
});

test('chat is rate limited and history is bounded', () => {
  const g = makeGame();
  const ws = lobby(g, 2);
  for (let i = 0; i < 8; i++) send(g, ws.p1, C.Chat, `m${i}`);
  assert.equal(g.chat.length, 5);
  assert.ok(ws.p1.sent.some((m) => m[0] === S.Chat && m[1].sys && /slow down/.test(m[1].text)));
  assert.ok(!ws.p2.sent.some((m) => m[0] === S.Chat && m[1].sys), 'notice is private');
  for (let i = 0; i < 300; i++) g.addChat({ userId: 'p2', name: 'p2', text: `x${i}` });
  assert.equal(g.chat.length, 80);
  assert.equal(g.chat.at(-1).text, 'x299');
});

test('chat does not leak the live word, but allows it on the score screen', () => {
  const g = makeGame();
  const ws = lobby(g, 4);
  startGame(g, ws);
  toDrawing(g);
  const word = g.currentRound.word;
  send(g, ws.p1, C.Chat, `it is ${word.toUpperCase()}!`);
  assert.ok(!g.chat.some((m) => m.text && m.text.toLowerCase().includes(word.toLowerCase())));
  assert.ok(ws.p1.sent.some((m) => m[0] === S.Chat && /word/.test(m[1].text)));
  send(g, ws.p2, C.Chat, 'good luck everyone');
  assert.equal(g.chat.length, 1);
  toScoreScreen(g);
  send(g, ws.p3, C.Chat, `it was ${word}`);
  assert.equal(g.chat.length, 2);
});

// ---- lifetime ----
test('stale games: empty unstarted lobbies after 2 minutes, anything idle after 10', () => {
  const g = makeGame();
  const now = g.lastActivity;
  assert.equal(isStale(g, now + EMPTY_MS - 1000), false);
  assert.equal(isStale(g, now + EMPTY_MS + 1000), true, 'nobody ever joined');
  const ws = lobby(g, 2);
  assert.equal(isStale(g, now + EMPTY_MS + 1000), false, 'players connected');
  assert.equal(isStale(g, now + IDLE_MS + 1000), false, 'live, heartbeat-checked players keep it for a while');
  assert.equal(isStale(g, now + LIVE_IDLE_MS + 1000), true, 'but 30 silent minutes ends it');
  ws.p1.close();
  ws.p2.close();
  assert.equal(g.activeCount, 0);
  const t = g.lastActivity;
  assert.equal(isStale(g, t + EMPTY_MS - 1000), false);
  assert.equal(isStale(g, t + EMPTY_MS + 1000), true, 'everyone left the lobby');
});

test('stale games: a started game whose players all dropped is kept for 10 minutes, then deleted', () => {
  const g = makeGame();
  const ws = lobby(g, 4);
  startGame(g, ws);
  for (const w of Object.values(ws)) w.close();
  assert.equal(g.activeCount, 0);
  const t = g.lastActivity;
  assert.equal(isStale(g, t + 5 * 60_000), false, 'players may come back');
  assert.equal(isStale(g, t + IDLE_MS + 1000), true);
  // a returning player resets the clock and the seat is still theirs
  const back = join(g, 'p1', 'p1');
  assert.equal(g.users.p1.status, Status.Connected);
  assert.equal(isStale(g, Date.now() + 5 * 60_000), false);
  void back;
});

test('stale games: finished games are deleted after 10 idle minutes', () => {
  const g = makeGame({ numRounds: 1, finalDrawdown: false });
  const ws = lobby(g, 4);
  startGame(g, ws);
  toScoreScreen(g);
  g.advance();
  assert.ok(g.finished);
  for (const w of Object.values(ws)) w.close(); // the client lets go of the socket after the summary
  assert.equal(isStale(g, g.lastActivity + 60_000), false);
  assert.equal(isStale(g, g.lastActivity + IDLE_MS + 1), true);
});

test('a lobby that is left by a vanished player is not listed once nobody is connected', () => {
  const g = makeGame();
  const w = join(g, 'a', 'a');
  assert.equal(g.activeCount, 1);
  w.close();
  assert.equal(g.activeCount, 0);
  assert.equal(g.userCount, 0);
});

// ---- player score on the server: only a clamped number is kept ----
test('rating: reported by the client, clamped, frozen once the game starts', () => {
  const g = makeGame();
  const w = new MockWs(g);
  g.connect(w, { userId: 'a1', userName: 'a1', rating: '250' });
  assert.equal(g.users.a1.rating, 250);
  assert.equal(sanitizeRating('abc'), 0);
  assert.equal(sanitizeRating(1e12), 99999);
  assert.equal(sanitizeRating(-1e12), -99999);
  assert.equal(sanitizeRating('-40.6'), -41);
  const ws = lobby(g, 3);
  g.connect(new MockWs(g), { userId: 'a1', userName: 'a1', rating: 400 }); // lobby: can still change
  assert.equal(g.users.a1.rating, 400);
  startGame(g, ws);
  g.connect(new MockWs(g), { userId: 'a1', userName: 'a1', rating: 9000 }); // started: frozen
  assert.equal(g.users.a1.rating, 400);
});

// ---- presence ----
test('presence: only changes are relayed, bad values and floods are ignored, disconnect resets', () => {
  const g = makeGame();
  const ws = lobby(g, 4);
  startGame(g, ws);
  const before = ws.p2.got(S.Presence).length;
  send(g, ws.p1, C.Presence, 0); // already 0: nothing
  send(g, ws.p1, C.Presence, 7);
  send(g, ws.p1, C.Presence, 'x');
  assert.equal(ws.p2.got(S.Presence).length, before);
  send(g, ws.p1, C.Presence, 1);
  assert.deepEqual(ws.p2.last(S.Presence), [S.Presence, 'p1', 1]);
  assert.equal(g.users.p1.presence, 1);
  send(g, ws.p1, C.Presence, 1); // same again: nothing
  assert.equal(ws.p2.got(S.Presence).length, before + 1);
  send(g, ws.p1, C.Presence, 2);
  send(g, ws.p1, C.Presence, 0);
  assert.equal(g.users.p1.presence, undefined);
  for (let i = 0; i < 40; i++) send(g, ws.p1, C.Presence, i % 2 === 0 ? 1 : 2);
  assert.ok(ws.p2.got(S.Presence).length <= before + 8, 'flooding is cut off');
  ws.p1.close();
  assert.equal(g.users.p1.presence, undefined);
});

// ---- random teams ----
function randomLobby(n) {
  const g = makeGame({ randomTeams: true });
  const ws = lobby(g, n);
  return { g, ws };
}
test('random teams: start needs 4 players and splits them evenly', () => {
  const small = randomLobby(3);
  assert.equal(small.g.canStart(), false);
  const { g, ws } = randomLobby(6);
  assert.ok(g.canStart());
  startGame(g, ws);
  assert.deepEqual([ids(g, 0).length, ids(g, 1).length], [3, 3]);
  assert.equal(new Set([...ids(g, 0), ...ids(g, 1)]).size, 6);
});
test('random teams: with an odd number either team gets the extra player (fifty-fifty)', () => {
  const big = [0, 0];
  for (let i = 0; i < 400; i++) {
    const { g, ws } = randomLobby(5);
    startGame(g, ws);
    const sizes = [ids(g, 0).length, ids(g, 1).length];
    assert.deepEqual([...sizes].sort(), [2, 3]);
    big[sizes[0] === 3 ? 0 : 1]++;
    g.destroy();
  }
  assert.ok(big[0] > 140 && big[1] > 140, `got ${big}`);
});
test('random teams: the manual teams survive a toggle and a cancelled countdown', () => {
  const g = makeGame();
  const ws = lobby(g, 6);
  send(g, ws.p1, C.JoinTeam, 1);
  const manual = g.teams.map((t) => [...t.userIds]);
  send(g, ws.p1, C.UpdateSettings, { ...g.settings, randomTeams: true });
  assert.deepEqual(g.teams.map((t) => t.userIds), manual, 'toggling does not touch the teams');
  send(g, ws.p1, C.UpdateSettings, { ...g.settings, randomTeams: false });
  assert.deepEqual(g.teams.map((t) => t.userIds), manual);
  send(g, ws.p1, C.UpdateSettings, { ...g.settings, randomTeams: true });
  g.onStartGame();
  assert.ok(g.inCountdown);
  g.onCancelStart();
  assert.deepEqual(g.teams.map((t) => [...t.userIds].sort()), manual.map((t) => [...t].sort()), 'cancel restores the manual teams');
  assert.equal(g.settings.randomTeams, true);
});
test('random teams: the setting is a strict boolean and appeals are off', () => {
  const g = makeGame();
  const ws = lobby(g, 6);
  send(g, ws.p1, C.UpdateSettings, { ...g.settings, randomTeams: 'yes' });
  assert.equal(g.settings.randomTeams, false);
  send(g, ws.p1, C.UpdateSettings, { ...g.settings, randomTeams: true });
  startGame(g, ws);
  toScoreScreen(g);
  const mate = ids(g, 0)[0];
  assert.equal(g.canSwitch(mate), false);
});
test('random teams: vote kick in the lobby only needs 5+ players in total', () => {
  const g = makeGame({ randomTeams: true });
  const ws = lobby(g, 5);
  assert.ok(g.canLoseMember(0));
  ws.p5.close();
  assert.equal(g.canLoseMember(0), false);
});

// ---- ending the game early ----
function playing(n = 4, settings = {}) {
  const g = makeGame({ numRounds: 3, ...settings });
  const ws = lobby(g, n);
  startGame(g, ws);
  toDrawing(g);
  return { g, ws };
}

test('more than half of the active players can end the game, and the score is worked out right away', () => {
  const { g, ws } = playing(4);
  const r = g.currentRound;
  const guesser = ids(g, 0).find((id) => id !== r.teamStates[0].drawerId);
  send(g, ws[guesser], C.UserGuess, 0, r.word);
  send(g, ws.p1, C.VoteEnd);
  send(g, ws.p2, C.VoteEnd);
  assert.equal(g.finished, false, '2 of 4 is not more than half');
  assert.deepEqual(ws.p3.last(S.EndVotes)[1].sort(), ['p1', 'p2']);
  send(g, ws.p2, C.VoteEnd); // withdraw
  send(g, ws.p2, C.VoteEnd);
  send(g, ws.p3, C.VoteEnd);
  assert.equal(g.finished, true);
  assert.equal(g.ended, true);
  assert.equal(g.endedEarly, 'vote');
  assert.equal(g.currentRound, undefined);
  assert.equal(g.previousRounds.length, 1, 'the round in progress counts as it stands');
  assert.equal(g.previousRounds[0].word, r.word);
  assert.deepEqual(ws.p4.last(S.GameEnded).slice(1), [true, 'vote']);
  assert.equal(g.snapshot('none').endedEarly, 'vote');
  assert.equal(g.lobbyInfo().stage, 'ended');
});

test('a vote to end needs a started game, a player on a team, and does nothing for spectators', () => {
  const g = makeGame({ numRounds: 3 });
  const ws = lobby(g, 4);
  send(g, ws.p1, C.VoteEnd);
  assert.equal(g.endVotes.size, 0, 'nothing to end in the lobby');
  startGame(g, ws);
  assert.equal(g.inCountdown, true);
  send(g, ws.p1, C.VoteEnd);
  assert.equal(g.endVotes.size, 0, 'not during the start countdown');
  toDrawing(g);
  const spec = new MockWs(g);
  g.connect(spec, { userId: 's', spectate: true });
  send(g, spec, C.VoteEnd);
  assert.equal(g.endVotes.size, 0);
});

test('ending the game before a word was chosen leaves out that round; it can end before any round was scored', () => {
  const g = makeGame({ numRounds: 3 });
  const ws = lobby(g, 4);
  startGame(g, ws);
  g.currentRound.startTime = g.now() - 1000;
  for (const id of ['p1', 'p2', 'p3']) send(g, ws[id], C.VoteEnd);
  assert.equal(g.finished, true);
  assert.equal(g.previousRounds.length, 0);
  assert.equal(g.currentRound, undefined);
  assert.equal(ws.p1.last(S.GameEnded)[1], false);
});

test('ending the game during the final drawdown keeps the final round for the score', () => {
  const { g, ws } = playing(4, { numRounds: 1 });
  toScoreScreen(g);
  g.advance();
  assert.ok(g.finalRound);
  for (const id of ['p1', 'p2', 'p3']) send(g, ws[id], C.VoteEnd);
  assert.equal(g.ended, true);
  assert.ok(g.finalRound);
  assert.equal(g.previousRounds.length, 1);
});

test('the game ends and is scored when everybody has disconnected for a while', () => {
  const { g, ws } = playing(4);
  for (const id of ['p1', 'p2', 'p3']) ws[id].close();
  assert.equal(g.finished, false);
  ws.p4.close();
  assert.ok(g.emptyTimer, 'a grace period starts');
  g.emptyTimer._onTimeout();
  assert.equal(g.finished, true);
  assert.equal(g.endedEarly, 'empty');
  assert.equal(g.previousRounds.length, 1);
});

test('somebody coming back within the grace period keeps the game going', () => {
  const { g, ws } = playing(4);
  for (const id of ['p1', 'p2', 'p3', 'p4']) ws[id].close();
  assert.ok(g.emptyTimer);
  join(g, 'p1');
  assert.equal(g.emptyTimer, undefined);
  assert.equal(g.finished, false);
});

// ---- joining a game in progress ----
test('a late joiner picks their team when the lobby allows it', () => {
  const { g } = playing(4, { lateJoinPickTeam: true });
  const a = new MockWs(g);
  g.connect(a, { userId: 'late1', userName: 'late1', team: 1 });
  assert.ok(ids(g, 1).includes('late1'));
  const b = new MockWs(g);
  g.connect(b, { userId: 'late2', userName: 'late2', team: 1 });
  assert.ok(ids(g, 1).includes('late2'), 'team choice beats balance');
});

test('without the pick-a-team option a late joiner goes to the smaller team', () => {
  const { g } = playing(5);
  const smaller = ids(g, 0).length < ids(g, 1).length ? 0 : 1;
  const a = new MockWs(g);
  g.connect(a, { userId: 'late1', userName: 'late1', team: 1 - smaller });
  assert.ok(ids(g, smaller).includes('late1'));
});

test('joining mid-game can be switched off', () => {
  const { g } = playing(4, { allowLateJoin: false });
  const a = new MockWs(g);
  g.connect(a, { userId: 'late1', userName: 'late1' });
  assert.equal(a.last(S.ServerError)[1].reason, 'late');
});

// ---- shared (community) word packs ----
test('a custom pack can be shared with everyone, within tight limits', () => {
  const words = Array.from({ length: 12 }, (_, i) => `shareword${i}`);
  const { meta } = addCustomPack({ name: 'shared test', words });
  const out = shareGlobal(meta.id);
  assert.equal(out.meta.id, meta.id);
  assert.ok(JSON.parse(globalListJson()).some((p) => p.id === meta.id));
  assert.equal(shareGlobal(meta.id).meta.id, meta.id, 'sharing twice is harmless');
  const tiny = addCustomPack({ name: 'tiny', words: ['a', 'b', 'c', 'd'] }).meta;
  assert.match(shareGlobal(tiny.id).error, /at least/);
  assert.match(shareGlobal(110943).error, /not found/, 'the official pack is not a custom pack');
  assert.ok(getWordListMeta(meta.id));
});

// ---- unready ----
test('clicking ready again takes it back straight away', () => {
  const g = makeGame();
  const ws = lobby(g, 6);
  startGame(g, ws);
  toScoreScreen(g);
  send(g, ws.p1, C.ReadyUp, 0);
  assert.ok(g.ready.has('p1'));
  send(g, ws.p1, C.ReadyUp, 0);
  assert.ok(!g.ready.has('p1'), 'unreadied');
  assert.deepEqual(ws.p2.last(S.ReadyUp).slice(1), [0, []], 'everybody is told');
  send(g, ws.p1, C.ReadyUp, 0);
  assert.ok(g.ready.has('p1'), 'ready again');
});

test('ready is ignored until the round is over', () => {
  const g = makeGame();
  const ws = lobby(g, 6);
  startGame(g, ws);
  // the round is still being drawn: nobody can ready up, not even everybody at once
  g.currentRound.word = g.currentRound.wordChoices[0];
  g.currentRound.wordChosenTime = g.now();
  for (const id of Object.keys(ws)) send(g, ws[id], C.ReadyUp, 0);
  assert.equal(g.ready.size, 0);
  assert.equal(g.previousRounds.length, 0, 'the round was not skipped');
  toScoreScreen(g);
  send(g, ws.p1, C.ReadyUp, 0);
  assert.ok(g.ready.has('p1'), 'allowed once the results show');
});

test('a new game allows joining mid-game by default', () => {
  const g = new Game('dflt', {});
  assert.equal(g.settings.allowLateJoin, true);
  g.destroy();
});

test('quick reactions are relayed to everyone, validated and rate limited, never stored', () => {
  const g = makeGame();
  const ws = lobby(g, 3);
  send(g, ws.p1, C.Reaction, 3);
  const m = ws.p2.last(S.Reaction)[1];
  assert.deepEqual(m, { r: 3, userId: 'p1', name: 'p1', team: g.teamIndexOf('p1') });
  assert.ok(ws.p1.last(S.Reaction), 'the sender sees their own reaction too');
  for (const bad of [-1, 8, 1.5, '2', null]) send(g, ws.p2, C.Reaction, bad);
  assert.equal(ws.p3.got(S.Reaction).length, 1, 'bad reaction ids are ignored');
  for (let i = 0; i < 6; i++) send(g, ws.p2, C.Reaction, 0);
  assert.equal(ws.p3.got(S.Reaction).length, 1 + 4, 'a burst is capped');
  assert.equal(g.chat.length, 0, 'reactions are not chat history');
  const spec = new MockWs(g);
  g.connect(spec, { userId: 's', spectate: true });
  send(g, spec, C.Reaction, 1);
  const sm = ws.p1.last(S.Reaction)[1];
  assert.equal(sm.userId, undefined, 'a spectator reaction never carries a user id');
  assert.equal(sm.team, -1);
});
