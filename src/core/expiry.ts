/** Most days a Daily point can repeat. Anything longer is saved as a Long-term point. */
export const MAX_DAILY_DAYS = 6;

/** Cleans up the number of days typed or stepped by the user, and says if it is too long for Daily. */
export function resolveDays(requested: number): { longTerm: boolean; days: number } {
  const days = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : 1;
  return { longTerm: days > MAX_DAILY_DAYS, days };
}

/** The moment a Daily point stops: local midnight at the end of its last day. Day 1 is the day of entry. */
export function expiryFor(entered: Date, days: number): Date {
  return new Date(entered.getFullYear(), entered.getMonth(), entered.getDate() + days, 0, 0);
}

/** The last day a point reminds (the day before its expiry moment), or null if it never expires. */
export function lastDayOf(expiresAt: string | null): Date | null {
  if (expiresAt === null) return null;
  const end = new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return null;
  return new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
