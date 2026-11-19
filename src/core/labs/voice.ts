// Experimental: builds a hands-free spoken review as a list of steps. The UI plays the steps with
// expo-speech while the app is open (iOS does not let a closed app speak) and releases it after.
import type { Language, Point } from '../types';

export type VoiceStep =
  | { kind: 'say'; text: string; locale: string; pointId: string }
  | { kind: 'pause'; ms: number };

export const LOCALES: Record<Language, string> = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' };
export const MAX_SPOKEN_POINTS = 5;
export const THINK_PAUSE_MS = 4000;
export const GAP_MS = 1200;

export interface VoiceScript {
  steps: VoiceStep[];
  /** Points left out because they are private; never spoken aloud. */
  skippedPrivate: number;
  estimatedSeconds: number;
}

export function buildVoiceScript(
  points: readonly Point[],
  privateMode: boolean,
  wordsPerMinute = 150,
): VoiceScript {
  const steps: VoiceStep[] = [];
  let skippedPrivate = 0;
  let spoken = 0;
  let words = 0;
  for (const p of points) {
    if (spoken >= MAX_SPOKEN_POINTS) break;
    if (privateMode || p.private) {
      skippedPrivate++;
      continue;
    }
    const locale = LOCALES[p.language];
    steps.push({ kind: 'say', text: p.prompt, locale, pointId: p.id });
    words += p.prompt.split(/\s+/).length;
    if (p.kind === 'qa' && p.answer) {
      steps.push({ kind: 'pause', ms: THINK_PAUSE_MS });
      steps.push({ kind: 'say', text: p.answer, locale, pointId: p.id });
      words += p.answer.split(/\s+/).length;
    }
    steps.push({ kind: 'pause', ms: GAP_MS });
    spoken++;
  }
  const pauseMs = steps.reduce((s, x) => s + (x.kind === 'pause' ? x.ms : 0), 0);
  return { steps, skippedPrivate, estimatedSeconds: Math.round((words / wordsPerMinute) * 60 + pauseMs / 1000) };
}
