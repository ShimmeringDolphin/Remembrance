// When reminders happen, and which points each one shows. Pure: no I/O, no timers.
//
// Each reminder shows a small handful of points, taking turns, so every notification can be read
// at a glance and every point gets its fair share. Long-term points join every third reminder.
import { sessionTimes } from './awake.ts';
import { activeAt } from './expiry.ts';
import { asLongTerm, paceWindows, splitDaily } from './pace.ts';
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

/** Reminder times after `now`, soonest first: every `every` minutes inside the from-to window, plus a chosen late-Awake session. Nothing while asleep. */
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
  // A late-Awake session adds its own times (outside the hours, before the next start time).
  out.push(...sessionTimes(settings, now, limit));
  out.sort((a, b) => a.getTime() - b.getTime());
  return out.slice(0, limit);
}

/**
 * The reminder's place in the turn order: day number times reminders a day, plus its step that day.
 * Counted on the local clock from the start of the window, so every time zone (IST is UTC+5:30)
 * gets consecutive turns, and jitter of up to 2 minutes never changes the count.
 */
function turnCounter(settings: Settings): (at: Date) => number {
  const allDay = settings.mode === 'button';
  const step = Math.max(15, settings.every);
  const start = allDay ? 0 : parseTime(settings.from);
  const length = allDay ? DAY_MINUTES : windowLength(settings.from, settings.to) || DAY_MINUTES;
  const perDay = Math.ceil(length / step);
  return (at) => {
    const local = Math.round(at.getTime() / 60000) - at.getTimezoneOffset();
    const offset = (((local - start) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    const day = Math.round((local - start - offset) / DAY_MINUTES);
    return day * perDay + Math.round(offset / step);
  };
}

const byAge = (a: Point, b: Point) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/**
 * Picks the points for each reminder time. The turn order comes from the time itself, so it
 * carries on fairly across rebookings instead of restarting with the same point.
 */
export function fillTimes(times: readonly Date[], points: readonly Point[], settings: Settings): Slot[] {
  const all = points.filter((p) => !p.archived).sort(byAge);
  if (all.length === 0) return [];
  const turn = turnCounter(settings);
  // Turn cycles only change when a point expires, so build each one once.
  const cycles = new Map<string, Point[][]>();
  const cycle = (list: Point[], size: number) => {
    const key = `${size}|${list.map((p) => p.id).join(',')}`;
    let c = cycles.get(key);
    if (!c) cycles.set(key, (c = paceWindows(list, size)));
    return c;
  };
  const ids = (windows: Point[][], n: number, count: number) => windows[n % windows.length].slice(0, count).map((p) => p.id);
  const out: Slot[] = [];
  for (const at of times) {
    // A Daily point never comes back at or after its expiry.
    const live = all.filter((p) => activeAt(p.expiresAt, at));
    if (live.length === 0) continue;
    const daily = live.filter((p) => p.category === 'daily');
    const longTerm = asLongTerm(live.filter((p) => p.category === 'long_term'));
    const n = turn(at);
    let pointIds: string[];
    if (daily.length === 0) {
      pointIds = ids(cycle(longTerm, HANDFUL), n, HANDFUL);
    } else {
      // Each point's pace decides its share of the turns (see pace.ts).
      const withLongTerm = longTerm.length > 0 && n % LONG_TERM_EVERY === 0;
      const room = withLongTerm ? HANDFUL - 1 : HANDFUL;
      // "Every reminder" points first, then the rotating ones in the places left.
      const { every, rotating } = splitDaily(daily);
      pointIds = every.slice(0, room).map((p) => p.id);
      const left = room - pointIds.length;
      if (left > 0 && rotating.length > 0) {
        // The rotating points form one stream of turns; each reminder takes the next `left` of
        // them. The stream position counts the places all earlier reminders had, so places lost
        // to a Long-term point never skip the same Daily point twice.
        const stream = cycle(rotating, 1).map((w) => w[0]);
        const base = HANDFUL - every.length;
        const start = n * base - (longTerm.length > 0 ? Math.ceil(n / LONG_TERM_EVERY) : 0);
        for (let k = 0; k < left; k++) {
          const id = stream[(((start + k) % stream.length) + stream.length) % stream.length].id;
          if (!pointIds.includes(id)) pointIds.push(id);
        }
      }
      if (withLongTerm) pointIds.push(...ids(cycle(longTerm, 1), Math.floor(n / LONG_TERM_EVERY), 1));
    }
    out.push({ at, pointIds });
  }
  return out;
}

export const planSlots = (points: readonly Point[], settings: Settings, now: Date, limit: number = MAX_BOOKED): Slot[] =>
  points.some((p) => !p.archived) ? fillTimes(planTimes(settings, now, limit), points, settings) : [];
