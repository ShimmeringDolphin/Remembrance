// When reminders happen, and which points each one shows. Pure: no I/O, no timers.
//
// Each reminder shows a small handful of points, taking turns, so every notification can be read
// at a glance and every point gets its fair share. Long-term points join every third reminder.
import { PACE_MINUTES } from './settings.ts';
import { parseTime, windowLength } from './time.ts';
import type { Point, Settings } from './types';

/** iOS keeps at most 64 pending notifications; stay a little under. */
export const MAX_BOOKED = 60;
export const DAYS_AHEAD = 14;
/** Reminders move by up to this many minutes so they do not feel like a clock. */
export const JITTER_MINUTES = 2;
/** Points shown in one reminder. */
export const HANDFUL = 3;
/** A Long-term point joins every this-many reminders (when there are Daily points too). */
export const LONG_TERM_EVERY = 3;

export interface Slot {
  at: Date;
  pointIds: string[];
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Reminder times after `now`, soonest first: every pace step inside the from-to window. Nothing while paused. */
export function planTimes(settings: Settings, now: Date, limit: number = MAX_BOOKED): Date[] {
  if (settings.paused || limit <= 0) return [];
  const length = windowLength(settings.from, settings.to);
  if (length === 0) return [];
  const step = PACE_MINUTES[settings.pace];
  const start = parseTime(settings.from);
  const out: Date[] = [];
  // Start yesterday: a window that crosses midnight may still be running this morning.
  for (let day = -1; day < DAYS_AHEAD && out.length < limit; day++) {
    const y = now.getFullYear();
    const mo = now.getMonth();
    const d = now.getDate() + day;
    for (let k = 0; k * step < length; k++) {
      const offset = k * step;
      let j = (hash(`${y}-${mo}-${d}|${k}`) % (2 * JITTER_MINUTES + 1)) - JITTER_MINUTES;
      if (offset + j < 0 || offset + j >= length) j = 0;
      const at = new Date(y, mo, d, 0, start + offset + j);
      if (at.getTime() > now.getTime()) out.push(at);
    }
  }
  out.sort((a, b) => a.getTime() - b.getTime());
  return out.slice(0, limit);
}

const byAge = (a: Point, b: Point) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

function take<T>(list: readonly T[], start: number, count: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.min(count, list.length); i++) out.push(list[(start + i) % list.length]);
  return out;
}

/**
 * Picks the points for each reminder time. The turn order comes from the time itself, so it
 * carries on fairly across rebookings instead of restarting with the same point.
 */
export function fillTimes(times: readonly Date[], points: readonly Point[], settings: Settings): Slot[] {
  const live = points.filter((p) => !p.archived).sort(byAge);
  const daily = live.filter((p) => p.category === 'daily');
  const longTerm = live.filter((p) => p.category === 'long_term');
  if (live.length === 0) return [];
  const stepMs = PACE_MINUTES[settings.pace] * 60000;
  return times.map((at) => {
    const n = Math.round(at.getTime() / stepMs);
    const ids: string[] = [];
    if (daily.length === 0) {
      ids.push(...take(longTerm, n * HANDFUL, HANDFUL).map((p) => p.id));
    } else {
      const withLongTerm = longTerm.length > 0 && n % LONG_TERM_EVERY === 0;
      ids.push(...take(daily, n * HANDFUL, withLongTerm ? HANDFUL - 1 : HANDFUL).map((p) => p.id));
      if (withLongTerm) ids.push(longTerm[Math.floor(n / LONG_TERM_EVERY) % longTerm.length].id);
    }
    return { at, pointIds: ids };
  });
}

export const planSlots = (points: readonly Point[], settings: Settings, now: Date, limit: number = MAX_BOOKED): Slot[] =>
  points.some((p) => !p.archived) ? fillTimes(planTimes(settings, now, limit), points, settings) : [];
