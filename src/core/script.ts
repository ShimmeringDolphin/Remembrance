// Which voice reads which part of a point? Decided by the letters themselves, so Hindi and Gujarati are read
// in their own voice even when the app is in English. Pure: no I/O.
import type { Language } from './types';

export interface Run {
  text: string;
  language: Language;
}

/**
 * Splits a point into runs by script, so a line that mixes English, Hindi and Gujarati is read in each voice
 * in turn. Letters decide the voice; spaces, digits and punctuation stay with the run they follow (or, at the
 * start, the run that comes next). With no letters at all the whole text is one run in `fallback`.
 */
export function scriptRuns(text: string, fallback: Language): Run[] {
  const scriptOf = (ch: string): Language | null => (/[ऀ-ॿ]/.test(ch) ? 'hi' : /[઀-૿]/.test(ch) ? 'gu' : /[A-Za-z]/.test(ch) ? 'en' : null);
  const runs: Run[] = [];
  let lead = '';
  for (const ch of text) {
    const sc = scriptOf(ch);
    const last = runs[runs.length - 1];
    if (sc === null) {
      if (last) last.text += ch;
      else lead += ch;
    } else if (last && last.language === sc) {
      last.text += ch;
    } else {
      runs.push({ text: (runs.length === 0 ? lead : '') + ch, language: sc });
    }
  }
  if (runs.length === 0) return text.trim() === '' ? [] : [{ text, language: fallback }];
  return runs.map((r) => ({ ...r, text: r.text.trim() })).filter((r) => r.text !== '');
}

/**
 * Plays runs one after another with `speakRun`, which calls `done` when that run is over for any reason (finished,
 * stopped or failed), so one run the engine cannot read never silences the ones after it. `alive` is asked before each
 * run: when it says false (the user stopped or started something else) the line ends. `onEnd` runs once, at the end.
 */
export function playRuns(runs: readonly Run[], speakRun: (run: Run, done: () => void) => void, alive: () => boolean, onEnd?: () => void): void {
  let ended = false;
  const end = () => {
    if (!ended) {
      ended = true;
      onEnd?.();
    }
  };
  const next = (i: number) => {
    if (!alive() || i >= runs.length) return end();
    let moved = false;
    const move = () => {
      if (moved) return;
      moved = true;
      next(i + 1);
    };
    try {
      speakRun(runs[i], move);
    } catch {
      move();
    }
  };
  next(0);
}
