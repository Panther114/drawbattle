import { Sound } from './shared.js';
import beepLow from './assets/sounds/beep_low.wav';
import beepHigh from './assets/sounds/beep_high.wav';
import correct from './assets/sounds/correct.wav';
import otherCorrect from './assets/sounds/other_correct.wav';
import clockTick from './assets/sounds/clock_tick.wav';
import buzzer from './assets/sounds/buzzer.wav';
import scoreTally from './assets/sounds/score_tally.wav';
import confettiPop from './assets/sounds/confetti_pop.wav';
import fanfare from './assets/sounds/fanfare.wav';

export const SOUND_URLS = {
  [Sound.BeepLow]: beepLow,
  [Sound.BeepHigh]: beepHigh,
  [Sound.CorrectGuess]: correct,
  [Sound.OtherTeamCorrectGuess]: otherCorrect,
  [Sound.ClockTick]: clockTick,
  [Sound.Buzzer]: buzzer,
  [Sound.ScoreTally]: scoreTally,
  [Sound.Confetti]: confettiPop,
  [Sound.Fanfare]: fanfare,
};

export async function playSound(kind) {
  const a = new Audio(SOUND_URLS[kind]);
  a.volume = 0.7;
  try {
    await a.play();
  } catch {
    // autoplay may be blocked
  }
}
