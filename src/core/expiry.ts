// Daily points repeat for a few days, then are put away. Day 1 is the day the point is written.

/** Most days a Daily point can repeat; asking for more saves it as Long-term, which never stops. */
export const MAX_DAILY_DAYS = 6;
export const DEFAULT_DAILY_DAYS = 1;

/** Whole days from 1 up; more than MAX_DAILY_DAYS means Long-term. */
export function resolveDays(requested: number): { days: number; longTerm: boolean } {
  const days = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : DEFAULT_DAILY_DAYS;
  return { days, longTerm: days > MAX_DAILY_DAYS };
}

/** Local midnight at the end of the last day. */
export function expiryFor(written: Date, days: number): Date {
  return new Date(written.getFullYear(), written.getMonth(), written.getDate() + days);
}

/** The last day a point comes back, or null when it never stops. */
export function lastDayOf(expiresAt: string | null): Date | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return null;
  return new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
}

/** Days from today until the last day, counting today as 1; null when the point never stops. */
export function daysFromToday(expiresAt: string | null, today: Date): number | null {
  const last = lastDayOf(expiresAt);
  if (!last) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((last.getTime() - start.getTime()) / 86400000) + 1;
}

export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** True when the point may still come back at `at`. */
export const activeAt = (expiresAt: string | null, at: Date) => !expiresAt || at.getTime() < Date.parse(expiresAt);
