// Books the reminders with the phone. Pure orchestration: every side effect is passed in, so the
// order of steps and the failure handling can be tested under Node without Expo.
//
// Asleep: everything is cancelled first, then verified, so Asleep wins even if a later step fails.
// The order matters. Everything that can fail (reading points, the permission check, planning) runs
// BEFORE the existing reminders are cancelled, so a failure there leaves the old bookings in place
// instead of wiping them and booking nothing.
import { countAppearances, parseBooked, type Booked } from './appearances.ts';
import { buildContent, type ContentText } from './content.ts';
import { planSlots } from './planner.ts';
import type { Category, Point, Settings } from './types';

/** One reminder, ready for the phone's scheduler. */
export interface Reminder {
  at: Date;
  title: string;
  body: string;
  category: Category;
  /** Ids only: the words are in `body` (and follow the privacy rules); this lets a tap open the moment. */
  pointIds: string[];
}

export interface BookingDeps {
  readBooked: () => Promise<string | null>;
  listPoints: () => Promise<Point[]>;
  /** Puts away Daily points whose last day has ended. */
  putAwayExpired: (now: Date) => Promise<void>;
  /** Whether notifications are allowed. May throw. */
  permissionGranted: () => Promise<boolean>;
  cancelAll: () => Promise<void>;
  /** How many reminders the phone still has booked. */
  countBooked: () => Promise<number>;
  /** Books one reminder. Throws when the phone refuses it. */
  schedule: (reminder: Reminder) => Promise<void>;
  record: (counts: Map<string, number>, lastAt: Map<string, string>, passed: number, latest: Booked | null, future: Booked[]) => Promise<void>;
}

export interface BookingResult {
  /** Reminders the phone accepted. */
  booked: number;
  /** Reminders the phone refused (the next run tries again). */
  failed: number;
  /** A step before cancelling failed, so the old bookings were left as they were. */
  aborted: boolean;
}

export async function bookReminders(deps: BookingDeps, settings: Settings, now: Date, limit: number, text: ContentText): Promise<BookingResult> {
  // Asleep always wins. The owner asked for silence, so clear every reminder first, before anything that
  // could fail (database, permission), and check that the phone really let go of them.
  if (settings.asleep) {
    await deps.cancelAll();
    if ((await deps.countBooked()) > 0) await deps.cancelAll();
  }
  let points: Point[];
  let granted: boolean;
  let counted: ReturnType<typeof countAppearances>;
  let slots: ReturnType<typeof planSlots>;
  try {
    counted = countAppearances(parseBooked(await deps.readBooked()), now);
    await deps.putAwayExpired(now);
    points = await deps.listPoints();
    granted = await deps.permissionGranted();
    slots = granted ? planSlots(points, settings, now, limit) : [];
  } catch {
    // Keep what is booked; the next rebook tries again. Never put point text in an error.
    return { booked: 0, failed: 0, aborted: true };
  }

  await deps.cancelAll();

  const byId = new Map<string, Point>(points.map((p) => [p.id, p]));
  const future: Booked[] = [];
  let failed = 0;
  for (const slot of slots) {
    const content = buildContent(slot.pointIds, byId, settings.privateMode, text);
    try {
      await deps.schedule({ at: slot.at, title: content.title, body: content.body, category: content.category, pointIds: slot.pointIds });
      future.push({ at: slot.at.toISOString(), pointIds: slot.pointIds });
    } catch {
      failed++;
    }
  }
  await deps.record(counted.counts, counted.lastAt, counted.passed, counted.latest, future);
  return { booked: future.length, failed, aborted: false };
}
