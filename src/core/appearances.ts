// How often each point has appeared, counted from booked reminders whose time has passed.
// Approximate: a phone that was off still counts. Counted only when reminders are rebooked anyway.

export interface Booked {
  at: string; // ISO 8601
  pointIds: string[];
}

export function countAppearances(booked: readonly Booked[], now: Date): { counts: Map<string, number>; lastAt: Map<string, string> } {
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

/** A damaged record reads as empty. */
export function parseBooked(json: string | null | undefined): Booked[] {
  if (!json) return [];
  try {
    const v: unknown = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (b): b is Booked =>
        typeof b === 'object' && b !== null && typeof b.at === 'string' && Array.isArray(b.pointIds) && b.pointIds.every((x: unknown) => typeof x === 'string'),
    );
  } catch {
    return [];
  }
}
