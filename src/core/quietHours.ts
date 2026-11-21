// Editing quiet hours in Settings. Pure logic; the scheduler applies them (see scheduler.ts).
import type { TimeRange } from './types';

/** How many quiet-hour ranges the Settings screen allows. */
export const MAX_QUIET_HOURS = 3;

/** A new range starts here; the user moves it with the From and To buttons. */
export const NEW_QUIET_RANGE: TimeRange = { start: '13:00', end: '14:00' };

/** Adds a range, unless the list is already full. Never changes the given list. */
export function addQuietRange(list: readonly TimeRange[]): TimeRange[] {
  if (list.length >= MAX_QUIET_HOURS) return [...list];
  return [...list, { ...NEW_QUIET_RANGE }];
}

export function removeQuietRange(list: readonly TimeRange[], index: number): TimeRange[] {
  return list.filter((_, i) => i !== index);
}

export function updateQuietRange(list: readonly TimeRange[], index: number, range: TimeRange): TimeRange[] {
  return list.map((r, i) => (i === index ? { ...range } : r));
}
