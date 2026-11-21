// Quiet hours: up to three daily ranges with no reminders.
import { isTime, parseTime } from './time.ts';
import type { TimeRange } from './types';

export const MAX_QUIET = 3;
/** Adds the range the user picked (nothing is prefilled), unless three already exist. */
export const addQuiet = (ranges: readonly TimeRange[], range: TimeRange): TimeRange[] =>
  ranges.length >= MAX_QUIET || !isRange(range) ? [...ranges] : [...ranges, { start: range.start, end: range.end }];
export const removeQuiet = (ranges: readonly TimeRange[], index: number): TimeRange[] => ranges.filter((_, i) => i !== index);
export const setQuiet = (ranges: readonly TimeRange[], index: number, field: 'start' | 'end', value: string): TimeRange[] =>
  ranges.map((r, i) => (i === index ? { ...r, [field]: value } : r));

export const isRange = (v: unknown): v is TimeRange =>
  typeof v === 'object' && v !== null && isTime((v as TimeRange).start) && isTime((v as TimeRange).end);

/** Is this minute of the day inside any range? A range runs from start up to, not including, end, and may cross midnight. */
export function inQuiet(minuteOfDay: number, ranges: readonly TimeRange[]): boolean {
  return ranges.some((r) => {
    const a = parseTime(r.start);
    const b = parseTime(r.end);
    if (a === b) return false;
    return a < b ? minuteOfDay >= a && minuteOfDay < b : minuteOfDay >= a || minuteOfDay < b;
  });
}
