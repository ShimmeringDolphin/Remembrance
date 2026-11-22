// A point's pace: how big a share of the turns it gets. Pure.
//
// Daily points only. "Every reminder" points (at most MAX_EVERY, oldest first) are in every Daily
// reminder; the rest share the other places, Often 2 : Normal 1. Long-term points always take
// normal turns. When every point has the same pace it is plain round-robin in age order.
import type { Pace, Point } from './types';

export const PACES: readonly Pace[] = ['every', 'often', 'normal'];
export const DEFAULT_PACE: Pace = 'normal';
/** At most this many Daily points can be in every reminder, so at least one place keeps rotating. */
export const MAX_EVERY = 2;
/** Shares of the rotating places. `every` points are not rotated; a share is kept for safety. */
export const SHARE: Record<Pace, number> = { every: 2, often: 2, normal: 1 };

/** Older builds stored `rarely`; it reads as normal. */
export const isPace = (v: unknown): v is Pace => v === 'every' || v === 'often' || v === 'normal';

/**
 * Splits live Daily points (in age order) into the ones shown in every reminder and the ones that
 * take turns. Any "every" point past MAX_EVERY takes turns as Often.
 */
export function splitDaily<T extends Point>(daily: readonly T[]): { every: T[]; rotating: T[] } {
  const every: T[] = [];
  const rotating: T[] = [];
  for (const p of daily) {
    if (p.pace === 'every' && every.length < MAX_EVERY) every.push(p);
    else rotating.push(p.pace === 'every' ? { ...p, pace: 'often' } : p);
  }
  return { every, rotating };
}

/** Long-term points always take normal turns. */
export const asNormal = <T extends Point>(list: readonly T[]): T[] => list.map((p) => (p.pace === 'normal' ? p : { ...p, pace: 'normal' }));

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
