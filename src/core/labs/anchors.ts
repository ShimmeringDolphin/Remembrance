// Experimental: "routine moments". Instead of repeating on a grid all day, review at a few chosen
// times (after waking, lunch, evening, bedtime). One grouped notification per moment, so a day
// has 4 interruptions instead of 16. Pure.
import { isActiveMinute, MAX_DAYS_AHEAD, MAX_PLANNED_NOTIFICATIONS, parseTime, type PlannedReminder } from '../scheduler.ts';
import type { Point, Settings } from '../types';

export function planAnchors(
  points: readonly Point[],
  settings: Settings,
  now: Date,
  limit: number = MAX_PLANNED_NOTIFICATIONS,
): PlannedReminder[] {
  if (!settings.awake || limit <= 0) return [];
  const ids = points.filter((p) => p.status === 'active').map((p) => p.id);
  if (ids.length === 0) return [];
  const minutes = [...new Set(settings.anchors.times.map(parseTime))].filter((m) => isActiveMinute(settings, m)).sort((a, b) => a - b);
  const out: PlannedReminder[] = [];
  for (let day = 0; day < MAX_DAYS_AHEAD && out.length < limit; day++) {
    for (const m of minutes) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, 0, m);
      if (at.getTime() > now.getTime()) out.push({ at, style: 'grouped', pointIds: ids });
    }
  }
  return out.slice(0, limit);
}
