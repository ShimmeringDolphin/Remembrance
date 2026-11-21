// When reminders happen, and which points each one shows. Pure: no I/O, no timers.
//
// Each reminder shows a small handful of points, taking turns, so every notification can be read
// at a glance and every point gets its fair share. Long-term points join every third reminder.
import { activeAt } from './expiry.ts';
import { inQuiet } from './quiet.ts';
import { DAY_MINUTES, parseTime, windowLength } from './time.ts';
import type { Point, Settings } from './types';

/** iOS keeps at most 64 pending notifications; stay a little under. */
export const MAX_BOOKED = 60;
/** Android has no such limit, but allows at most 500 alarms per app; 120 keeps rebooking quick. */
export const MAX_BOOKED_ANDROID = 120;
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

/** Reminder times after `now`, soonest first: every `every` minutes inside the from-to window. Nothing while asleep. */
export function planTimes(settings: Settings, now: Date, limit: number = MAX_BOOKED): Date[] {
  if (settings.asleep || limit <= 0) return [];
  // Button mode: all day while Awake. Hours mode: only From to Until.
  const allDay = settings.mode === 'button';
  const length = allDay ? DAY_MINUTES : windowLength(settings.from, settings.to);
  if (length === 0) return [];
  const step = Math.max(15, settings.every);
  const start = allDay ? 0 : parseTime(settings.from);
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
      if (at.getTime() <= now.getTime()) continue;
      if (inQuiet(at.getHours() * 60 + at.getMinutes(), settings.quiet)) continue;
      out.push(at);
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
  const all = points.filter((p) => !p.archived).sort(byAge);
  if (all.length === 0) return [];
  const stepMs = Math.max(15, settings.every) * 60000;
  const out: Slot[] = [];
  for (const at of times) {
    // A Daily point never comes back at or after its expiry.
    const live = all.filter((p) => activeAt(p.expiresAt, at));
    const daily = live.filter((p) => p.category === 'daily');
    const longTerm = live.filter((p) => p.category === 'long_term');
    if (live.length === 0) continue;
    const n = Math.round(at.getTime() / stepMs);
    const ids: string[] = [];
    if (daily.length === 0) {
      ids.push(...take(longTerm, n * HANDFUL, HANDFUL).map((p) => p.id));
    } else {
      const withLongTerm = longTerm.length > 0 && n % LONG_TERM_EVERY === 0;
      ids.push(...take(daily, n * HANDFUL, withLongTerm ? HANDFUL - 1 : HANDFUL).map((p) => p.id));
      if (withLongTerm) ids.push(longTerm[Math.floor(n / LONG_TERM_EVERY) % longTerm.length].id);
    }
    out.push({ at, pointIds: ids });
  }
  return out;
}

export const planSlots = (points: readonly Point[], settings: Settings, now: Date, limit: number = MAX_BOOKED): Slot[] =>
  points.some((p) => !p.archived) ? fillTimes(planTimes(settings, now, limit), points, settings) : [];
