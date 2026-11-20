// How often each point has appeared. Counted from reminders the app booked whose time has passed,
// so it is approximate: a phone that was off still counts. No timers, no listeners: counted when
// reminders are rebooked anyway.

export interface BookedReminder {
  /** ISO 8601 time the notification was booked for. */
  at: string;
  pointIds: string[];
}

export interface Appearances {
  /** Point id to how many passed reminders included it. */
  counts: Map<string, number>;
  /** Point id to the latest passed reminder time that included it. */
  lastAt: Map<string, string>;
}

export function countAppearances(booked: readonly BookedReminder[], now: Date): Appearances {
  const counts = new Map<string, number>();
  const lastAt = new Map<string, string>();
  for (const b of booked) {
    const t = Date.parse(b.at);
    if (!Number.isFinite(t) || t > now.getTime()) continue;
    for (const id of new Set(b.pointIds)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
      const prev = lastAt.get(id);
      if (!prev || Date.parse(prev) < t) lastAt.set(id, b.at);
    }
  }
  return { counts, lastAt };
}

/** Reads the stored booking list defensively: a damaged record counts as empty. */
export function parseBooked(json: string | null | undefined): BookedReminder[] {
  if (!json) return [];
  try {
    const value: unknown = JSON.parse(json);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (b): b is BookedReminder =>
        typeof b === 'object' && b !== null && typeof b.at === 'string' && Array.isArray(b.pointIds) && b.pointIds.every((id: unknown) => typeof id === 'string'),
    );
  } catch {
    return [];
  }
}
