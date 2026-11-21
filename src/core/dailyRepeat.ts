// Daily points repeat for a few days, then archive themselves. Pure logic, local dates only.
import type { Point } from './types';

/** A daily point repeats on at most this many days (counting the day it is entered). */
export const MAX_DAILY_REPEAT_DAYS = 6;

/** Local calendar date as "YYYY-MM-DD", which also sorts correctly as text. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_KEY.test(value);
}

/** The local date `days` days after `date` (negative goes back). */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Keeps a repeat count between 1 and the maximum, defaulting to 1. */
export function clampRepeatDays(days: number): number {
  if (!Number.isFinite(days)) return 1;
  return Math.min(MAX_DAILY_REPEAT_DAYS, Math.max(1, Math.floor(days)));
}

/** Last day a daily point reminds when entered (or changed) on `today` to repeat for `days` days. */
export function repeatUntilFor(today: Date, days: number): string {
  return localDateKey(addDays(today, clampRepeatDays(days) - 1));
}

/** Days left counting today (1 = last day is today). 0 when the last day has passed. */
export function daysLeft(repeatUntil: string, today: Date): number {
  const m = DATE_KEY.exec(repeatUntil);
  if (!m) return 0;
  const last = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const start = addDays(today, 0);
  // Round, because a daylight-saving change makes one day 23 or 25 hours long.
  const diff = Math.round((last.getTime() - start.getTime()) / 86_400_000);
  return Math.max(0, diff + 1);
}

/** True when the point had a last day and it is before `today`. Points without one never expire. */
export function isExpired(point: Pick<Point, 'repeatUntil'>, today: Date): boolean {
  return point.repeatUntil !== null && point.repeatUntil < localDateKey(today);
}
