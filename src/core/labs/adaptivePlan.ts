// Experimental: plans reminders for adaptive points from each point's own due time.
// One pending chain per point instead of a fixed daily grid, so a point that is stretching to
// 3 days books 1 notification, not 16 a day. Reminders are snapped to shared slots so grouped
// mode can still merge points into one notification.
import { isActiveMinute, MAX_PLANNED_NOTIFICATIONS } from '../scheduler.ts';
import type { PlannedReminder } from '../scheduler';
import type { Point, Settings } from '../types';
import type { PointMemory } from './memory.ts';

/** Reminder times round up to this grid, so points due close together share one notification. */
export const SLOT_MINUTES = 15;
/** If the user ignores a reminder, the same point is booked again at its gap, at most this many times. */
export const MAX_FOLLOW_UPS = 2;
const DAY = 1440;

/** First slot at or after `from` that is inside the active window, or null if none within 3 days. */
export function snapToActiveSlot(from: Date, settings: Settings): Date | null {
  const slotMs = SLOT_MINUTES * 60000;
  let t = Math.ceil(from.getTime() / slotMs) * slotMs;
  for (let i = 0; i < (3 * DAY) / SLOT_MINUTES; i++, t += slotMs) {
    const d = new Date(t);
    if (isActiveMinute(settings, d.getHours() * 60 + d.getMinutes())) return d;
  }
  return null;
}

export function planAdaptive(
  points: readonly Point[],
  memories: ReadonlyMap<string, PointMemory>,
  settings: Settings,
  now: Date,
  limit: number = MAX_PLANNED_NOTIFICATIONS,
): PlannedReminder[] {
  if (!settings.awake || limit <= 0) return [];
  const grouped = new Map<number, string[]>();
  const individual: PlannedReminder[] = [];

  for (const point of points) {
    const mem = memories.get(point.id);
    if (point.status !== 'active' || !mem) continue;
    const style = point.notificationStyle ?? settings.notificationStyle;
    let due = Math.max(Date.parse(mem.nextDueAt), now.getTime() + 60000);
    for (let n = 0; n <= MAX_FOLLOW_UPS; n++) {
      const slot = snapToActiveSlot(new Date(due), settings);
      if (!slot) break;
      if (style === 'grouped') {
        const ids = grouped.get(slot.getTime());
        if (ids) ids.push(point.id);
        else grouped.set(slot.getTime(), [point.id]);
      } else {
        individual.push({ at: slot, style: 'individual', pointIds: [point.id] });
      }
      due = slot.getTime() + mem.intervalMinutes * 60000;
    }
  }
  const out: PlannedReminder[] = [...individual];
  for (const [time, ids] of grouped) out.push({ at: new Date(time), style: 'grouped', pointIds: ids });
  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  return out.slice(0, limit);
}
