import { parseTime } from './scheduler.ts';

/** Moves an "HH:mm" time by `deltaMinutes`, wrapping around midnight. */
export function shiftTime(value: string, deltaMinutes: number): string {
  const total = (((parseTime(value) + deltaMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
