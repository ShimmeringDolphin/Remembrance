// How late reminders really arrived, worked out from the notifications still in the tray. Pure.
//
// Each reminder carries the time it was due (`at`). Android stamps a notification with the moment
// it was posted, so posted minus due is the delay. When a phone holds reminders back and shows them
// together, several arrive within a minute or two of each other with due times spread over hours.

/** A delay of at least this many minutes counts as late. */
export const LATE_MINUTES = 10;
/** One reminder this late is enough to say so. */
export const VERY_LATE_MINUTES = 30;
/** Only arrivals within this many hours are judged, so old notifications left in the tray do not count. */
export const JUDGE_HOURS = 24;
/** Reminders posted within this many minutes of each other arrived "together". */
export const TOGETHER_MINUTES = 2;
/** The tip is not shown again for this many days after it was dismissed. */
export const TIP_PAUSE_DAYS = 3;

/** What the data carried by a reminder holds; `at` is the due time as an ISO string. */
export const reminderData = (r: { pointIds: string[]; at: Date }) => ({ pointIds: r.pointIds, at: r.at.toISOString() });

export interface Presented {
  /** When the phone posted the notification: milliseconds on Android (seconds are tolerated). */
  date: number;
  data: unknown;
}

export interface Arrival {
  dueAt: number;
  arrivedAt: number;
  lateMinutes: number;
}

const toMs = (n: number) => (n < 1e11 ? n * 1000 : n);

export function arrivals(presented: readonly Presented[]): Arrival[] {
  const out: Arrival[] = [];
  for (const p of presented) {
    if (typeof p.date !== 'number' || !Number.isFinite(p.date)) continue;
    const at = typeof p.data === 'object' && p.data !== null ? (p.data as { at?: unknown }).at : undefined;
    const dueAt = typeof at === 'string' ? Date.parse(at) : NaN;
    if (!Number.isFinite(dueAt)) continue;
    const arrivedAt = toMs(p.date);
    out.push({ dueAt, arrivedAt, lateMinutes: Math.max(0, Math.round((arrivedAt - dueAt) / 60000)) });
  }
  return out.sort((a, b) => a.arrivedAt - b.arrivedAt);
}

export interface Timing {
  /** Reminders judged (arrived within JUDGE_HOURS). */
  judged: number;
  late: boolean;
  /** Several late reminders landed together, the sign of a phone holding them back. */
  together: boolean;
  worstMinutes: number;
}

export function judgeTiming(list: readonly Arrival[], now: Date): Timing {
  const since = now.getTime() - JUDGE_HOURS * 3600000;
  const recent = list.filter((a) => a.arrivedAt >= since && a.arrivedAt <= now.getTime() + 60000);
  const lateOnes = recent.filter((a) => a.lateMinutes >= LATE_MINUTES);
  const worstMinutes = recent.reduce((m, a) => Math.max(m, a.lateMinutes), 0);
  let together = false;
  for (let i = 0; i < lateOnes.length && !together; i++) {
    const group = lateOnes.filter((a) => Math.abs(a.arrivedAt - lateOnes[i].arrivedAt) <= TOGETHER_MINUTES * 60000);
    together = group.length >= 3 && Math.max(...group.map((a) => a.dueAt)) - Math.min(...group.map((a) => a.dueAt)) >= LATE_MINUTES * 60000;
  }
  const late = lateOnes.length >= 2 || worstMinutes >= VERY_LATE_MINUTES;
  return { judged: recent.length, late, together, worstMinutes };
}

/** Show the "reminders are late" tip: only when late, and not again soon after it was dismissed. */
export function showTimingTip(t: Timing, dismissedAt: number | null, now: Date): boolean {
  if (!t.late) return false;
  return dismissedAt === null || now.getTime() - dismissedAt > TIP_PAUSE_DAYS * 86400000;
}
