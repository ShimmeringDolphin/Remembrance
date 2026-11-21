import { shiftTime } from './time.ts';
import type { TimeRange } from './types';

/** Most quiet-hour ranges the user can set. */
export const MAX_QUIET_RANGES = 3;

/** Adds a new range (13:00 to 14:00) unless the maximum is reached. */
export function addQuietRange(ranges: readonly TimeRange[]): TimeRange[] {
  if (ranges.length >= MAX_QUIET_RANGES) return [...ranges];
  return [...ranges, { start: '13:00', end: '14:00' }];
}

export function removeQuietRange(ranges: readonly TimeRange[], index: number): TimeRange[] {
  return ranges.filter((_, i) => i !== index);
}

/** Moves the start or end of one range by `deltaMinutes`, wrapping around midnight. */
export function shiftQuietRange(
  ranges: readonly TimeRange[],
  index: number,
  field: 'start' | 'end',
  deltaMinutes: number,
): TimeRange[] {
  return ranges.map((r, i) => (i === index ? { ...r, [field]: shiftTime(r[field], deltaMinutes) } : r));
}
