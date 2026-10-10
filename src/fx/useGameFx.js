// Watches the live game and fires the celebration effects: lightning-fast guesses, win streaks,
// ties and lead changes, plus the smaller everyday ones (my team scores, a round wraps up, time runs low).
import { computed, watch } from 'vue';
import {
  RoundStage,
  displayName,
  drawingStartTime,
  findCorrectGuess,
  guessMatches,
  roundScores,
  roundWinner,
  totalScores,
} from '../shared.js';
import { TEAM_COLORS, centerOf, fx, fxOn } from './fx.js';
import { sfx } from './sfx.js';

const FAST_MS = 5000;

// consecutive round wins by the same team, counting back from the last round
function teamStreak(rounds) {
  let team;
  let n = 0;
  for (let i = rounds.length - 1; i >= 0; i--) {
    const w = roundWinner(rounds[i]);
    if (w === undefined || (team !== undefined && w !== team)) break;
    team = w;
    n += 1;
  }
  return { team, n };
}

// 0 / 1 for the leading team, -1 for a tie
const leaderOf = (t) => (t[0] === t[1] ? -1 : t[0] > t[1] ? 0 : 1);

export function useGameFx({ game, userId, teamIndex, roundStage, roundSecondsRemaining, view, live }) {
  const teamName = (i) => game.value?.teams[i]?.name ?? `team ${i + 1}`;
  const nameOf = (id) => {
    const u = game.value?.users[id];
    return u ? displayName(u) : 'someone';
  };
  const where = (sel) => centerOf(document.querySelector(sel));

  // ---- correct guesses (rounds and the final drawdown) ----
  const seenGuesses = new Set();
  let seenGame;
  function scanGuesses(announce) {
    const g = game.value;
    if (!g) return;
    const r = g.currentRound;
    if (r?.word !== undefined) {
      r.teamStates.forEach((ts, team) => {
        const hit = findCorrectGuess(ts.guesses, r.word);
        const key = `r${g.previousRounds.length}-${team}`;
        if (!hit || seenGuesses.has(key)) return;
        seenGuesses.add(key);
        if (announce) onCorrect(team, hit, hit.timestamp - drawingStartTime(r, team));
      });
    }
    const fr = g.finalRound;
    fr?.teamStates.forEach((states, team) =>
      states.forEach((st, i) => {
        const key = `f${i}-${team}`;
        const hit = st.guesses.find((x) => guessMatches(x.guess, fr.words[i]));
        if (!hit || seenGuesses.has(key)) return;
        seenGuesses.add(key);
        if (announce) onCorrect(team, hit, hit.timestamp - st.startTime, true);
      }),
    );
  }

  function onCorrect(team, hit, ms, final = false) {
    const mine = team === teamIndex.value;
    const me = hit.userId === userId.value;
    const at = where(mine ? '.mp-canvas-container .dc-container, .dc-container' : '.ot-canvas, .ot-root');
    if (mine) {
      fx('burst', { ...at, colors: TEAM_COLORS[team], count: me ? 70 : 40, spread: 90, velocity: me ? 38 : 28 });
      if (me) fx('flash', { color: TEAM_COLORS[team][0] });
    } else {
      fx('burst', { ...at, colors: ['#d0d0d0', TEAM_COLORS[team][0]], count: 18, spread: 50, velocity: 18, scalar: 0.7 });
    }
    if (ms >= 0 && ms <= FAST_MS) {
      const secs = (Math.max(ms, 0) / 1000).toFixed(1);
      fx('banner', {
        text: me ? 'lightning fast!' : `${nameOf(hit.userId)} is lightning fast!`,
        sub: `${final ? 'final word ' : ''}guessed in ${secs}s for ${teamName(team)}`,
        tone: 'fast',
        icon: 'bolt',
        sound: 'sparkle',
      });
      fx('burst', { x: window.innerWidth / 2, y: window.innerHeight - 150, colors: ['#ffe006', '#ffa620', '#ffffff'], shapes: ['star'], count: 36, spread: 120, velocity: 24 });
    }
  }

  // ---- scores: ties and lead changes, live as points land ----
  const liveTotals = computed(() => {
    const g = game.value;
    if (!g) return undefined;
    const rounds = g.currentRound?.word !== undefined ? [...g.previousRounds, g.currentRound] : g.previousRounds;
    if (rounds.length === 0 && !g.finalRound) return undefined;
    return totalScores(rounds, g.finalRound);
  });
  let lastLeader;
  watch(
    () => (liveTotals.value ? liveTotals.value.join(',') : ''),
    () => {
      const t = liveTotals.value;
      if (!t || t.length !== 2) return;
      const leader = leaderOf(t);
      const before = lastLeader;
      lastLeader = leader;
      if (!live.value || before === undefined || before === leader || t[0] + t[1] === 0) return;
      if (leader === -1) {
        fx('banner', { text: 'all tied up!', sub: `${t[0]} – ${t[1]}`, tone: 'tie', icon: 'scale', sound: 'swap' });
      } else if (before !== -1) {
        const ours = leader === teamIndex.value;
        fx('banner', {
          text: 'lead change!',
          sub: `${teamName(leader)} ${ours ? '(your team) ' : ''}pulls ahead ${t[leader]} – ${t[1 - leader]}`,
          tone: leader === 0 ? 'team0' : 'team1',
          icon: 'swap',
          sound: 'swap',
        });
        fx('confetti', { side: leader === 0 ? 'left' : 'right', colors: TEAM_COLORS[leader], count: 40 });
      }
    },
  );

  // ---- a round wraps up: streaks, my team's win, the swipe into the results ----
  const doneRounds = new Set();
  watch(roundStage, (stage, prev) => {
    const g = game.value;
    const r = g?.currentRound;
    if (!live.value || !r || r.word === undefined) return;
    const idx = g.previousRounds.length;
    if (stage === RoundStage.DrawingEnd || (stage === RoundStage.ScoreScreen && prev !== RoundStage.DrawingEnd)) {
      if (doneRounds.has(idx)) return;
      doneRounds.add(idx);
      const winner = roundWinner(r);
      const streak = teamStreak([...g.previousRounds, r]);
      if (winner !== undefined && winner === teamIndex.value) fx('confetti', { colors: TEAM_COLORS[winner], count: 55 });
      if (streak.n >= 3) {
        later(
          () =>
            fx('banner', {
              text: `${streak.n} in a row!`,
              sub: `${teamName(streak.team)} is on fire`,
              tone: 'fire',
              icon: 'flame',
              sound: 'tada',
              ms: 2900,
            }),
          winner === teamIndex.value ? 650 : 200,
        );
      }
    }
    if (stage === RoundStage.ScoreScreen && prev !== undefined && prev !== RoundStage.ScoreScreen) {
      const winner = roundWinner(r);
      const scores = roundScores(r);
      fx('wipe', {
        text: winner === undefined ? `round ${idx + 1}: nobody got it` : `round ${idx + 1} goes to ${teamName(winner)} +${scores[winner]}`,
        color: winner === undefined ? '#d0d0d0' : TEAM_COLORS[winner][0],
      });
    }
  });

  // ---- the clock is running out (a soft pulsing vignette, never over the canvas itself) ----
  const urgent = computed(
    () => live.value && view.value === 'round' && roundStage.value === RoundStage.Drawing && roundSecondsRemaining.value <= 10 && roundSecondsRemaining.value > 0,
  );
  watch(roundSecondsRemaining, (s) => {
    if (!urgent.value || !fxOn()) return;
    if (s <= 5) sfx('tick');
    // the clock gives a little heartbeat every second it has left
    document.querySelector('.mp-drawing-countdown')?.animate(
      [{ transform: 'scale(1)', color: '' }, { transform: 'scale(1.28)', color: '#ef5c3c', offset: 0.3 }, { transform: 'scale(1)', color: '' }],
      { duration: 520, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    );
  });

  // my own guesses: a shake for a miss, a green glow for a hit
  let myGuessCount = -1;
  watch(
    () => {
      const r = game.value?.currentRound;
      const ts = r?.teamStates[teamIndex.value];
      return ts ? ts.guesses.filter((x) => x.userId === userId.value).length : -1;
    },
    (n) => {
      const prev = myGuessCount;
      myGuessCount = n;
      if (n <= prev && n !== -1) return;
      const r = game.value?.currentRound;
      const ts = r?.teamStates[teamIndex.value];
      if (prev < 0 || !live.value || !fxOn() || !ts || r.word === undefined) return;
      const mine = ts.guesses.filter((x) => x.userId === userId.value);
      const last = mine[mine.length - 1];
      const input = document.querySelector('.mp-guess-input');
      if (!input || !last) return;
      if (guessMatches(last.guess, r.word)) {
        input.animate([{ boxShadow: '0 0 0 0 #98ff87' }, { boxShadow: '0 0 0 8px #98ff8700' }], { duration: 700, easing: 'ease-out' });
      } else {
        input.animate(
          [{ translate: '0' }, { translate: '-7px' }, { translate: '6px' }, { translate: '-4px' }, { translate: '2px' }, { translate: '0' }],
          { duration: 360, easing: 'ease-out' },
        );
      }
    },
  );

  const timers = [];
  function later(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }

  // new guesses arrive by mutation, so the scan is driven by a cheap signature
  watch(
    () => {
      const g = game.value;
      if (!g) return '';
      const r = g.currentRound;
      const a = r ? r.teamStates.map((t) => t.guesses.length).join('.') : '';
      const b = g.finalRound ? g.finalRound.teamStates.map((s) => s.map((x) => x.guesses.length).join('.')).join('|') : '';
      return `${g.previousRounds.length}:${r?.word ?? ''}:${a}:${b}`;
    },
    () => {
      // the first look at a game (a load, a reload or a reconnect snapshot) only learns what already happened
      const fresh = game.value !== seenGame;
      seenGame = game.value;
      scanGuesses(!fresh && live.value);
    },
    { immediate: true },
  );

  return {
    urgent,
    dispose: () => timers.forEach(clearTimeout),
  };
}
