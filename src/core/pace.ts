// A point's pace: how big a share of the turns it gets. Pure.
//
// Shares are Often 4 : Normal 2 : Rarely 1. The turn order is built as whole reminders ("windows")
// by stride scheduling: each point has a pass that moves on by 4 / share every time it is shown,
// and each window takes the points with the lowest pass that it does not hold yet. That spreads a
// point's turns evenly and never puts it twice in one reminder. When every point has the same
// pace it is plain round-robin in age order, as before paces existed.
import type { Pace } from './types';

export const PACES: readonly Pace[] = ['often', 'normal', 'rarely'];
export const DEFAULT_PACE: Pace = 'normal';
export const SHARE: Record<Pace, number> = { often: 4, normal: 2, rarely: 1 };

export const isPace = (v: unknown): v is Pace => v === 'often' || v === 'normal' || v === 'rarely';

/**
 * One full cycle of reminders, each holding up to `size` different points. The cycle has one
 * window per share, so each point is in about `share x size` windows of it. `points` must already
 * be in their fair (age) order.
 */
export function paceWindows<T extends { pace: Pace }>(points: readonly T[], size: number): T[][] {
  if (points.length === 0 || size <= 0) return [];
  // Integers only: strides 1, 2 and 4, starting half a stride in so Often points do not bunch up.
  const stride = points.map((p) => 4 / SHARE[p.pace]);
  const pass = stride.map((s) => s / 2);
  const total = points.reduce((sum, p) => sum + SHARE[p.pace], 0);
  const out: T[][] = [];
  for (let w = 0; w < total; w++) {
    const window: number[] = [];
    while (window.length < Math.min(size, points.length)) {
      let best = -1;
      for (let i = 0; i < points.length; i++) {
        if (window.includes(i)) continue;
        if (best < 0 || pass[i] < pass[best]) best = i;
      }
      window.push(best);
      pass[best] += stride[best];
    }
    out.push(window.map((i) => points[i]));
  }
  return out;
}
