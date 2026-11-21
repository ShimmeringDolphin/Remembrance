// What the home-screen widget shows: the points of the reminder that came last (or, before the
// first one, the next one), with the same privacy rules as a notification. Pure.
import type { Booked } from './appearances';

export function widgetSlot(booked: readonly Booked[], lastShown: Booked | null, now: Date): Booked | null {
  const t = now.getTime();
  let latest: Booked | null = lastShown && Date.parse(lastShown.at) <= t ? lastShown : null;
  let next: Booked | null = null;
  for (const b of booked) {
    const at = Date.parse(b.at);
    if (!Number.isFinite(at)) continue;
    if (at <= t) {
      if (!latest || Date.parse(latest.at) < at) latest = b;
    } else if (!next || at < Date.parse(next.at)) next = b;
  }
  return latest ?? next;
}
