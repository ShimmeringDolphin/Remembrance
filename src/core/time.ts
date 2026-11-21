export const DAY_MINUTES = 1440;

/** "HH:mm" to minutes after midnight. Throws on bad input. */
export function parseTime(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid time "${value}"`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`Invalid time "${value}"`);
  return h * 60 + min;
}

export const isTime = (value: unknown): value is string => typeof value === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(value);

export function formatTime(minutes: number): string {
  const total = ((Math.round(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export const shiftTime = (value: string, delta: number): string => formatTime(parseTime(value) + delta);

/** Length of the window from `from` to `to` in minutes; 0 when they are equal. */
export function windowLength(from: string, to: string): number {
  const a = parseTime(from);
  const b = parseTime(to);
  return a === b ? 0 : (b - a + DAY_MINUTES) % DAY_MINUTES;
}
