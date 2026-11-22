// A point's pace: how big a share of the turns it gets. Pure.
//
// Daily points: Every reminder (at most MAX_EVERY, oldest first, in every Daily reminder), Often or
// Normal. Long-term points: Often, Normal or Rarely. Shares of the rotating places are
// Often 4 : Normal 2 : Rarely 1. When every point has the same pace it is plain round-robin.
import type { Category, Pace, Point } from './types';

export const PACES: Record<Category, readonly Pace[]> = { daily: ['every', 'often', 'normal'], long_term: ['often', 'normal', 'rarely'] };
export const DEFAULT_PACE: Pace = 'normal';
/** At most this many Daily points can be in every reminder, so at least one place keeps rotating. */
export const MAX_EVERY = 2;
/** Shares of the rotating places. `every` points are not rotated; a share is kept for safety. */
export const SHARE: Record<Pace, number> = { every: 4, often: 4, normal: 2, rarely: 1 };

export const isPace = (v: unknown): v is Pace => v === 'every' || v === 'often' || v === 'normal' || v === 'rarely';

/** The pace a point really takes turns at, for its category. */
export function paceFor(p: Pick<Point, 'pace' | 'category'>): Pace {
  return PACES[p.category].includes(p.pace) ? p.pace : p.pace === 'every' ? 'often' : 'normal';
}

/**
 * Splits live Daily points (in age order) into the ones shown in every reminder and the ones that
 * take turns. Any "every" point past MAX_EVERY takes turns as Often.
 */
export function splitDaily<T extends Point>(daily: readonly T[]): { every: T[]; rotating: T[] } {
  const every: T[] = [];
  const rotating: T[] = [];
  for (const p of daily) {
    const pace = paceFor(p);
    if (pace === 'every' && every.length < MAX_EVERY) every.push(p);
    else rotating.push(pace === p.pace && pace !== 'every' ? p : { ...p, pace: pace === 'every' ? 'often' : pace });
  }
  return { every, rotating };
}

/** Long-term points take turns at their own pace; a Daily-only value reads as the nearest one. */
export const asLongTerm = <T extends Point>(list: readonly T[]): T[] => list.map((p) => (paceFor(p) === p.pace ? p : { ...p, pace: paceFor(p) }));

/**
 * One full cycle of reminders, each holding up to `size` different points. Each point is due again
 * every 1 / share of a round, starting at a small offset that follows age order, and each pick
 * takes the point most overdue that the reminder does not hold yet. Shares come out exact over the
 * cycle, turns are spread evenly, and with equal shares it is plain round-robin in age order.
 */
export function paceWindows<T extends { pace: Pace }>(points: readonly T[], size: number): T[][] {
  if (points.length === 0 || size <= 0) return [];
  const share = points.map((p) => SHARE[p.pace]);
  const total = share.reduce((a, b) => a + b, 0);
  const shown = share.map(() => 0);
  const due = (i: number) => (shown[i] + (i + 0.5) / points.length) / share[i];
  const width = Math.min(size, points.length);
  const out: T[][] = [];
  // `total` windows of `width` picks cover `width` whole rounds, so the cycle repeats cleanly.
  for (let w = 0; w < total; w++) {
    const window: number[] = [];
    while (window.length < width) {
      let best = -1;
      for (let i = 0; i < points.length; i++) {
        if (window.includes(i)) continue;
        if (best < 0 || due(i) < due(best)) best = i;
      }
      shown[best]++;
      window.push(best);
    }
    out.push(window.map((i) => points[i]));
  }
  return out;
}
