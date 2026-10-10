import test from 'node:test';
import assert from 'node:assert/strict';
import { COEFF, buildFacts, computeMatch, creditFor, replay } from './rating.js';

const part = (id, res, rounds = [], r0 = 0) => ({ id, r0, res, rounds });
const sum = (t) => Object.values(t).reduce((a, r) => a + r.delta, 0);

test('credit: full for the first team, half for the second, faster is worth more', () => {
  assert.equal(creditFor(1, 1), COEFF.base + COEFF.span);
  assert.equal(creditFor(1, 0), COEFF.base);
  assert.equal(creditFor(2, 1), (COEFF.base + COEFF.span) * COEFF.second);
  assert.ok(creditFor(1, 0.8) > creditFor(1, 0.3));
  assert.equal(creditFor(1, 5), creditFor(1, 1), 'time is clamped');
  assert.equal(creditFor(1, -3), creditFor(1, 0));
});

test('every match shares out exactly +100, whatever the lobby looks like', () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 2; n <= 16; n++) {
    for (let trial = 0; trial < 30; trial++) {
      const parts = [];
      for (let i = 0; i < n; i++) {
        const rounds = [];
        for (let k = 0; k < Math.floor(rnd() * 8); k++) rounds.push([rnd() < 0.5 ? 'g' : 'd', rnd() < 0.5 ? 1 : 2, Math.round(rnd() * 100) / 100]);
        parts.push(part('u' + i, ['w', 'l', 'd'][Math.floor(rnd() * 3)], rounds, Math.round((rnd() - 0.5) * 2000)));
      }
      const t = computeMatch({ parts });
      assert.equal(sum(t), 100, `n=${n} trial=${trial}`);
      for (const r of Object.values(t)) assert.ok(Number.isInteger(r.delta));
    }
  }
});

test('one team gains what the other loses: +500 on one side means -400 on the other', () => {
  // symmetric lobby: team A earns a lot, team B nothing
  const parts = [];
  for (let i = 0; i < 4; i++) parts.push(part('a' + i, 'w', [['g', 1, 1], ['d', 1, 1], ['g', 1, 1], ['d', 1, 1], ['g', 1, 1]]));
  for (let i = 0; i < 4; i++) parts.push(part('b' + i, 'l'));
  const t = computeMatch({ parts });
  const a = [0, 1, 2, 3].reduce((x, i) => x + t['a' + i].delta, 0);
  const b = [0, 1, 2, 3].reduce((x, i) => x + t['b' + i].delta, 0);
  assert.equal(a + b, 100);
  assert.ok(a > 100 && b < 0, `a=${a} b=${b}`);
  assert.equal(a, 100 - b);
});

test('individual skill is rewarded inside a team and points can go negative', () => {
  const parts = [
    part('fast', 'w', [['g', 1, 0.9], ['g', 1, 0.9], ['d', 1, 0.9]]),
    part('slow', 'w', [['g', 1, 0.1]]),
    part('lazy', 'w'),
    part('o1', 'l', [['g', 2, 0.5]]),
    part('o2', 'l'),
    part('o3', 'l'),
  ];
  const t = computeMatch({ parts });
  assert.ok(t.fast.delta > t.slow.delta && t.slow.delta > t.lazy.delta);
  assert.ok(t.o2.delta < 0 && t.o3.delta < 0, 'players who did nothing and lost lose points');
});

test('only first guessers earn: a second teammate gets nothing, the other team gets half', () => {
  // facts only list scoring entries, so the 2nd guesser simply has no entry; check the halved credit
  const t = computeMatch({
    parts: [part('first', 'l', [['g', 1, 0.5]]), part('second', 'l'), part('other', 'l', [['g', 2, 0.5]]), part('x', 'l')],
  });
  assert.equal(t.first.guess, creditFor(1, 0.5));
  assert.equal(t.second.guess, 0);
  assert.equal(t.other.guess, creditFor(1, 0.5) / 2);
});

test('the strength term: a stronger player has to out-score the lobby', () => {
  const rounds = [['g', 1, 0.5]];
  const t = computeMatch({ parts: [part('hi', 'w', rounds, 1000), part('lo', 'w', rounds, 0), part('m1', 'l', [], 500), part('m2', 'l', [], 500)] });
  assert.ok(t.lo.delta > t.hi.delta, 'same performance, the weaker player gains more');
  assert.equal(sum(t), 100);
});

test('the same table comes out whatever order the players arrive in', () => {
  const parts = [part('b', 'w', [['g', 1, 0.4]]), part('a', 'w', [['g', 1, 0.4]]), part('c', 'l'), part('d', 'l')];
  const t1 = computeMatch({ parts });
  const t2 = computeMatch({ parts: [...parts].reverse() });
  assert.deepEqual(t1, t2);
});

test('history is replayed with the current coefficients, so changing them updates the score', () => {
  const m = (k, win) => ({
    k,
    t: 0,
    me: 'me',
    parts: [part('me', win ? 'w' : 'l', [['g', 1, 0.5]]), part('x', win ? 'l' : 'w'), part('y', win ? 'l' : 'w'), part('z', win ? 'l' : 'w')],
  });
  const matches = [m('g1', true), m('g2', false), m('g3', true)];
  const a = replay(matches);
  assert.equal(a.history.length, 3);
  assert.equal(a.rating, a.history.reduce((s, h) => s + h.delta, 0));
  const b = replay(matches, { ...COEFF, win: 0, draw: 0 });
  assert.notEqual(a.rating, b.rating);
  assert.deepEqual(replay(matches), a, 'deterministic');
  // stored matches only hold facts: no deltas or ratings
  assert.ok(!('delta' in matches[0]));
});

test('buildFacts: who guessed first, drawer credit, result', () => {
  const T0 = 1_000_000;
  const word = 'cat';
  const round = (aGuessAt, bGuessAt) => ({
    word,
    wordChosenTime: T0,
    chooserId: 'a1',
    chooserHeadStartSeconds: 0,
    teamStates: [
      { drawerId: 'a1', guesses: [{ userId: 'a2', guess: 'dog', timestamp: T0 + 4000 }, { userId: 'a2', guess: 'cat', timestamp: T0 + aGuessAt }, { userId: 'a3', guess: 'cat', timestamp: T0 + aGuessAt + 500 }] },
      { drawerId: 'b1', guesses: bGuessAt ? [{ userId: 'b2', guess: 'cat', timestamp: T0 + bGuessAt }] : [] },
    ],
  });
  const game = {
    id: 'abcd',
    settings: { roundLengthSec: 60 },
    teams: [{ userIds: ['a1', 'a2', 'a3'] }, { userIds: ['b1', 'b2'] }],
    users: { a1: { rating: 10 }, a2: { rating: 0 }, a3: {}, b1: {}, b2: { rating: -5 } },
    previousRounds: [round(13_000, 20_000), round(40_000, 0)],
    finalRound: undefined,
  };
  const f = buildFacts(game, 'k');
  const p = Object.fromEntries(f.parts.map((x) => [x.id, x]));
  assert.equal(p.a1.r0, 10);
  assert.equal(p.b2.r0, -5);
  assert.deepEqual(p.a2.rounds.map((r) => r[0] + r[1]), ['g1', 'g1'], 'a2 was first both times');
  assert.deepEqual(p.a3.rounds, [], 'the second guesser gets nothing');
  assert.deepEqual(p.a1.rounds.map((r) => r[0] + r[1]), ['d1', 'd1']);
  assert.deepEqual(p.b2.rounds.map((r) => r[0] + r[1]), ['g2'], 'the other team came second in round 1 and not at all in round 2');
  assert.equal(p.a2.rounds[0][2], 0.83, 'guessed 10 s into a 60 s round (after the 3 s countdown)');
  assert.equal(p.a2.rounds[1][2], 0.38);
  assert.deepEqual([p.a1.res, p.b1.res], ['w', 'l']);
});

test('team performance mark ignores who won: speed and word rate decide', async () => {
  const { teamPerformance, markFor } = await import('./shared.js');
  const T = 60;
  // drawing starts at wordChosenTime + 3 s countdown; `t` is seconds after that, undefined = never guessed
  const round = (a, b) => ({
    word: 'cat',
    wordChosenTime: 0,
    chooserId: 'x',
    chooserHeadStartSeconds: 0,
    teamStates: [a, b].map((t, i) => ({
      drawerId: 'd' + i,
      guesses: t === undefined ? [] : [{ userId: 'u', guess: 'cat', timestamp: 3000 + t * 1000 }],
    })),
  });
  // both teams are quick: both get a top mark, even though only one of them won
  const quick = [round(3, 5), round(4, 6)];
  assert.equal(teamPerformance(quick, 0, T).mark, 'S');
  assert.equal(teamPerformance(quick, 1, T).mark, 'S');
  // the winner of every round is slow and misses half the words
  const slowWinner = [round(55, undefined), round(58, undefined)];
  assert.equal(teamPerformance(slowWinner, 0, T).mark, 'D', 'winning does not lift a slow team');
  assert.equal(teamPerformance(slowWinner, 1, T).mark, 'F', 'never guessing is an F');
  assert.equal(teamPerformance([], 0, T), undefined);
  assert.deepEqual(['S', 'A', 'B', 'C', 'D', 'F'], [1, 0.75, 0.6, 0.45, 0.25, 0].map(markFor));
});
