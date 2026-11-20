// Experimental: on-device insights from the review log and memory state. Nothing leaves the phone.
// All outputs are suggestions; the user decides. No guilt mechanics: a missed day costs a "rest
// token" before it costs the run.
import type { Point, ReviewLogEntry, TimeRange } from '../types';
import type { PointMemory } from './memory.ts';

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export interface Rhythm {
  /** Days in a row with at least one answered reminder, forgiving rest days. */
  run: number;
  restTokens: number;
  /** Last 7 days, oldest first, today last. */
  week: boolean[];
}

const MAX_REST_TOKENS = 2;

/** An "answered" review is remembered or again_soon; a dismissed reminder is not practice. */
export function rhythm(log: readonly ReviewLogEntry[], now: Date): Rhythm {
  const days = new Set<string>();
  let first: Date | null = null;
  for (const e of log) {
    if (e.answer === 'dismissed') continue;
    const d = new Date(e.shownAt);
    days.add(dayKey(d));
    if (!first || d < first) first = d;
  }
  const today = startOfDay(now);
  const week: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    week.push(days.has(dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i))));
  }
  if (!first) return { run: 0, restTokens: 1, week };

  let run = 0;
  let tokens = 1;
  let active = 0;
  // Walk every day from the first review up to yesterday; today is still open so it never breaks the run.
  for (let d = startOfDay(first); d < today; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    if (days.has(dayKey(d))) {
      run++;
      active++;
      if (active % 7 === 0) tokens = Math.min(MAX_REST_TOKENS, tokens + 1);
    } else if (tokens > 0) {
      tokens--;
    } else {
      run = 0;
    }
  }
  if (days.has(dayKey(today))) run++;
  return { run, restTokens: tokens, week };
}

export interface HourBucket {
  shown: number;
  answered: number;
}

export function hourlyEngagement(log: readonly ReviewLogEntry[]): HourBucket[] {
  const buckets: HourBucket[] = Array.from({ length: 24 }, () => ({ shown: 0, answered: 0 }));
  for (const e of log) {
    const b = buckets[new Date(e.shownAt).getHours()];
    b.shown++;
    if (e.answer !== 'dismissed') b.answered++;
  }
  return buckets;
}

/**
 * Hours where reminders were mostly ignored, merged into ranges, as a suggestion for quiet hours.
 * Needs at least `minShown` reminders in an hour before judging it.
 */
export function suggestQuietHours(buckets: readonly HourBucket[], minShown = 8, maxRate = 0.2): TimeRange[] {
  const quiet = buckets.map((b) => b.shown >= minShown && b.answered / b.shown <= maxRate);
  const pad = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  const ranges: TimeRange[] = [];
  let h = 0;
  while (h < 24) {
    if (!quiet[h]) {
      h++;
      continue;
    }
    let end = h;
    while (end < 24 && quiet[end]) end++;
    ranges.push({ start: pad(h), end: pad(end) });
    h = end;
  }
  return ranges;
}

export interface PointAdvice {
  pointId: string;
  /** `graduate`: suggest moving to Long-term. `reword`: keeps being forgotten. `gentler`: keeps being ignored. */
  kind: 'graduate' | 'reword' | 'gentler';
}

/** Suggestions only. Nothing here changes a point. */
export function adviseOnPoints(
  points: readonly Point[],
  memories: ReadonlyMap<string, PointMemory>,
): PointAdvice[] {
  const out: PointAdvice[] = [];
  for (const p of points) {
    const m = memories.get(p.id);
    if (!m || p.status !== 'active') continue;
    if (m.lapses >= 4 && m.streak < 2) out.push({ pointId: p.id, kind: 'reword' });
    else if (m.ignored >= 3) out.push({ pointId: p.id, kind: 'gentler' });
    else if (p.category === 'daily' && m.streak >= 8) out.push({ pointId: p.id, kind: 'graduate' });
  }
  return out;
}
