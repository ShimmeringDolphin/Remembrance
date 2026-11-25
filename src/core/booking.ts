// Books the reminders with the phone. Pure orchestration: every side effect is passed in, so the
// order of steps and the failure handling can be tested under Node without Expo.
//
// Asleep: everything is cancelled first, then verified, so Asleep wins even if a later step fails.
// The order matters. Everything that can fail (reading points, the permission check, planning) runs
// BEFORE the existing reminders are cancelled, so a failure there leaves the old bookings in place
// instead of wiping them and booking nothing.
import { greetingFor, noteTime, planPrompts, RUNWAY_AFTER_HOURS, type PromptText } from './awake.ts';
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
  /** A wake-up prompt while Asleep: holds no point text and is never counted as an appearance. */
  prompt?: boolean;
  /** The last booked notification: "open the app to keep reminders coming". No point text, never an appearance. */
  runway?: boolean;
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
  /** Wake-up prompts the phone accepted (not counted in `booked`). */
  prompts: number;
  /** 1 when the "open the app" note was booked after the last reminder (not counted in `booked`). */
  runway: number;
  /** A step before cancelling failed, so the old bookings were left as they were. */
  aborted: boolean;
}

export async function bookReminders(deps: BookingDeps, settings: Settings, now: Date, limit: number, text: ContentText, promptText?: PromptText): Promise<BookingResult> {
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
  let prompts: Date[] = [];
  try {
    counted = countAppearances(parseBooked(await deps.readBooked()), now);
    // Daily points are not put away while Asleep: their days are given back when the user wakes.
    if (!settings.asleep) await deps.putAwayExpired(now);
    points = await deps.listPoints();
    granted = await deps.permissionGranted();
    // One place in the cap is kept for the "open the app" note after the last reminder.
    slots = granted ? planSlots(points, settings, now, promptText ? limit - 1 : limit) : [];
    // Prompts only when there is something to remind about and the phone allows notifications.
    if (granted && promptText && points.some((p) => !p.archived)) prompts = planPrompts(settings, now);
  } catch {
    // Keep what is booked; the next rebook tries again. Never put point text in an error.
    return { booked: 0, prompts: 0, runway: 0, failed: 0, aborted: true };
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
  let promptsBooked = 0;
  if (promptText) {
    for (const at of prompts) {
      try {
        await deps.schedule({ at, title: promptText[greetingFor(at)], body: promptText.body, category: 'daily', pointIds: [], prompt: true });
        promptsBooked++;
      } catch {
        failed++;
      }
    }
  }
  // One quiet note asks the user to open the app after about two days without opening it, so reminders never
  // just stop: two minutes after the first reminder due 48 hours from now, or after the last booked one if those end sooner.
  // Every rebook (every app open) moves it two days further on, so a user who opens the app never sees it.
  let runwayBooked = 0;
  const horizon = now.getTime() + RUNWAY_AFTER_HOURS * 3600000;
  const last = slots.find((s) => s.at.getTime() >= horizon) ?? slots[slots.length - 1];
  if (promptText && last) {
    // At night or in a quiet hour the note waits for the morning (From, or the end of the quiet hour).
    const at = noteTime(settings, new Date(last.at.getTime() + 2 * 60000));
    if (at) {
      try {
        await deps.schedule({ at, title: promptText.runwayTitle, body: promptText.runwayBody, category: 'daily', pointIds: [], runway: true });
        runwayBooked = 1;
      } catch {
        failed++;
      }
    }
  }
  await deps.record(counted.counts, counted.lastAt, counted.passed, counted.latest, future);
  return { booked: future.length, prompts: promptsBooked, runway: runwayBooked, failed, aborted: false };
}
