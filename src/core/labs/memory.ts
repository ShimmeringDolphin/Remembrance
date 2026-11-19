// Experimental ("open-creativity"): adaptive spacing per point. Pure; no I/O, timers or Expo imports.
//
// Idea: instead of one fixed gap for every point, each point keeps a small memory state. Answering
// "Remembered" stretches its gap; "Again soon" shortens it; dismissing a reminder changes nothing,
// because ignoring is not evidence of forgetting. The user opts in per point; nothing moves between
// Daily and Long-term automatically (see insights.ts for suggestions only).
//
// Model notes (verified against public FSRS write-ups, but this is a deliberately simplified,
// explainable cousin, not FSRS): "stability" S is the gap after which recall is about 90%, and the
// forgetting curve is a power function, R(t) = (1 + F*t/S)^-D with F chosen so R(S) = 0.9.
import type { Category, ReviewAnswer } from '../types';
import { MIN_INTERVAL_MINUTES } from '../scheduler.ts';

export const FORGET_DECAY = 0.5;
/** F such that (1 + F)^-D = 0.9. With D = 0.5 this is 19/81. */
export const FORGET_FACTOR = Math.pow(0.9, -1 / FORGET_DECAY) - 1;

export const EASE_MIN = 1.3;
export const EASE_MAX = 2.8;
export const EASE_START = 2.0;
/** After "Again soon" the point comes back this soon, whatever its normal gap. */
export const AGAIN_SOON_MINUTES = 10;
/** Longest gap per category. Daily points are drilled within the day; long-term ones stretch to months. */
export const MAX_INTERVAL: Record<Category, number> = { daily: 12 * 60, long_term: 60 * 1440 };

export interface PointMemory {
  pointId: string;
  /** Current gap in minutes (the stability S). */
  intervalMinutes: number;
  ease: number;
  /** Consecutive "Remembered". */
  streak: number;
  lapses: number;
  /** Consecutive dismissed reminders. */
  ignored: number;
  lastReviewedAt: string | null;
  nextDueAt: string;
}

export function newMemory(pointId: string, now: Date, startMinutes = 60): PointMemory {
  const interval = Math.max(MIN_INTERVAL_MINUTES, Math.round(startMinutes));
  return {
    pointId,
    intervalMinutes: interval,
    ease: EASE_START,
    streak: 0,
    lapses: 0,
    ignored: 0,
    lastReviewedAt: null,
    nextDueAt: new Date(now.getTime() + interval * 60000).toISOString(),
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Returns the new memory after an answer. Never mutates the input. */
export function applyAnswer(
  memory: PointMemory,
  answer: ReviewAnswer,
  category: Category,
  now: Date,
): PointMemory {
  const max = MAX_INTERVAL[category];
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60000).toISOString();
  switch (answer) {
    case 'remembered': {
      const ease = Math.min(EASE_MAX, memory.ease + 0.08);
      const interval = clamp(Math.round(memory.intervalMinutes * ease), MIN_INTERVAL_MINUTES, max);
      return {
        ...memory,
        ease,
        intervalMinutes: interval,
        streak: memory.streak + 1,
        ignored: 0,
        lastReviewedAt: now.toISOString(),
        nextDueAt: at(interval),
      };
    }
    case 'again_soon': {
      const ease = Math.max(EASE_MIN, memory.ease - 0.2);
      const interval = clamp(Math.round(memory.intervalMinutes * 0.4), MIN_INTERVAL_MINUTES, max);
      return {
        ...memory,
        ease,
        intervalMinutes: interval,
        streak: 0,
        lapses: memory.lapses + 1,
        ignored: 0,
        lastReviewedAt: now.toISOString(),
        nextDueAt: at(AGAIN_SOON_MINUTES),
      };
    }
    case 'dismissed':
      return { ...memory, ignored: memory.ignored + 1, nextDueAt: at(memory.intervalMinutes) };
  }
}

/** Chance (0 to 1) the user could still recall the point at `now`. 1 right after review, 0.9 one gap later. */
export function retrievability(memory: PointMemory, now: Date): number {
  if (!memory.lastReviewedAt) return 0.6; // never reviewed: unknown, treated as middling
  const t = Math.max(0, (now.getTime() - Date.parse(memory.lastReviewedAt)) / 60000);
  return Math.pow(1 + (FORGET_FACTOR * t) / memory.intervalMinutes, -FORGET_DECAY);
}
