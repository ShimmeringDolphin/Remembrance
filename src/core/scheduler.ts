// Pure reminder planning. No I/O, no timers, no notification APIs, so it can be unit tested.
// Behaviour is described in docs/SPEC.md ("Scheduling" and "Battery and memory").
import type { Frequency, NotificationStyle, Point, Settings, TimeRange } from './types';

/** Shortest allowed gap between reminders for one point (proposal in the spec). */
export const MIN_INTERVAL_MINUTES = 15;
/** iOS keeps at most 64 pending local notifications; stay a little under it. */
export const MAX_PLANNED_NOTIFICATIONS = 60;
/** How many days ahead to look when the limit is not reached sooner. */
export const MAX_DAYS_AHEAD = 14;
/** Reminder times are nudged by up to this many minutes so they do not all land on the hour. */
export const JITTER_MINUTES = 3;
/**
 * Grouped reminders move by up to this many minutes, the same for every point in the slot so they
 * still arrive as one notification. Small enough that the 15-minute minimum gap still holds.
 */
export const GROUPED_JITTER_MINUTES = 2;

const DAY = 1440;

export interface PlannedReminder {
  at: Date;
  /** `grouped`: one notification that opens Review now. `individual`: one point. */
  style: NotificationStyle;
  pointIds: string[];
}

export function parseTime(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid time "${value}", expected HH:mm`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`Invalid time "${value}"`);
  return h * 60 + min;
}

/** True when minute-of-day `m` is inside [start, end). A range with start > end crosses midnight. */
function inRange(m: number, range: TimeRange): boolean {
  const start = parseTime(range.start);
  const end = parseTime(range.end);
  if (start === end) return false;
  return start < end ? m >= start && m < end : m >= start || m < end;
}

interface Window {
  /** Minute-of-day where the first reminder of each day falls. */
  anchor: number;
  /** Length in minutes of the stretch in which reminders may fall. */
  span: number;
  isActive: (m: number) => boolean;
}

function buildWindow(settings: Settings): Window {
  const inQuiet = (m: number) => settings.quietHours.some((q) => inRange(m, q));
  if (settings.activeMode === 'button_only') {
    return { anchor: 0, span: DAY, isActive: (m) => !inQuiet(m) };
  }
  const start = parseTime(settings.activeHours.start);
  const end = parseTime(settings.activeHours.end);
  const span = start === end ? 0 : (end - start + DAY) % DAY;
  return {
    anchor: start,
    span,
    isActive: (m) => inRange(m, settings.activeHours) && !inQuiet(m),
  };
}

/** Whole minutes between reminders for a point, never below the minimum. */
export function intervalMinutes(
  frequency: Frequency,
  settings: Settings,
  activeMinutesPerDay: number,
): number {
  const f = frequency.mode === 'default' ? settings.defaultFrequency : frequency;
  let minutes: number;
  if (f.mode === 'interval') {
    minutes = f.everyMinutes;
  } else if (f.mode === 'per_day') {
    minutes = f.timesPerDay >= 1 ? Math.floor(activeMinutesPerDay / f.timesPerDay) : NaN;
  } else {
    minutes = NaN;
  }
  if (!Number.isFinite(minutes)) minutes = 60;
  return Math.max(MIN_INTERVAL_MINUTES, Math.floor(minutes));
}

/** Small stable hash so jitter and staggering are the same on every run. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Plans the next reminders after `now`, soonest first, at most `limit`.
 *
 * - Nothing is planned while asleep, or when there are no active minutes.
 * - Each day, a point is reminded every `interval` minutes starting at the first active minute.
 * - Reminders that fall in quiet hours are dropped, not moved.
 * - Grouped points that share a time become one reminder; individual points are staggered
 *   so they do not all fire together.
 */
export function planReminders(
  points: readonly Point[],
  settings: Settings,
  now: Date,
  limit: number = MAX_PLANNED_NOTIFICATIONS,
): PlannedReminder[] {
  if (!settings.awake || limit <= 0) return [];
  const win = buildWindow(settings);
  if (win.span === 0) return [];

  let activeMinutesPerDay = 0;
  for (let m = 0; m < DAY; m++) if (win.isActive(m)) activeMinutesPerDay++;
  if (activeMinutesPerDay === 0) return [];

  const candidates = points.filter((p) => p.status === 'active');
  if (candidates.length === 0) return [];

  const result: PlannedReminder[] = [];
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let day = 0; day < MAX_DAYS_AHEAD && result.length < limit; day++) {
    const y = startOfToday.getFullYear();
    const mo = startOfToday.getMonth();
    const d = startOfToday.getDate() + day;
    const dayKey = `${y}-${mo}-${d}`;
    const groupedByTime = new Map<number, string[]>();
    const dayReminders: PlannedReminder[] = [];

    for (const point of candidates) {
      const style = point.notificationStyle ?? settings.notificationStyle;
      const interval = intervalMinutes(point.frequency, settings, activeMinutesPerDay);
      // Individual points start at a stable offset inside the interval so they spread out.
      const offset = style === 'individual' ? hash(point.id) % interval : 0;

      for (let k = 0; win.anchor + offset + k * interval < win.anchor + win.span; k++) {
        const base = win.anchor + offset + k * interval;
        const jitterRange = Math.min(JITTER_MINUTES, Math.floor(interval / 6));
        let minute = base;
        if (jitterRange > 0 && style === 'individual') {
          const j = (hash(`${point.id}|${dayKey}|${k}`) % (2 * jitterRange + 1)) - jitterRange;
          if (win.isActive(((base + j) % DAY + DAY) % DAY)) minute = base + j;
        } else if (style === 'grouped') {
          // Keyed by day and base minute only, so every point sharing this slot moves together.
          const j = (hash(`grouped|${dayKey}|${base}`) % (2 * GROUPED_JITTER_MINUTES + 1)) - GROUPED_JITTER_MINUTES;
          if (win.isActive(((base + j) % DAY + DAY) % DAY)) minute = base + j;
        }
        if (!win.isActive(minute % DAY)) continue;
        const at = new Date(y, mo, d, 0, minute);
        if (at.getTime() <= now.getTime()) continue;

        if (style === 'grouped') {
          const ids = groupedByTime.get(at.getTime());
          if (ids) ids.push(point.id);
          else groupedByTime.set(at.getTime(), [point.id]);
        } else {
          dayReminders.push({ at, style: 'individual', pointIds: [point.id] });
        }
      }
    }

    for (const [time, ids] of groupedByTime) {
      dayReminders.push({ at: new Date(time), style: 'grouped', pointIds: ids });
    }
    dayReminders.sort((a, b) => a.at.getTime() - b.at.getTime());
    result.push(...dayReminders);
  }

  return result.slice(0, limit);
}
