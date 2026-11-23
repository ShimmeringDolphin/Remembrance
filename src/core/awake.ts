// Awake and Asleep on top of the From/Until hours. Pure: no I/O, no timers.
//
// Asleep always wins and stays until Awake. While Asleep, up to three silent prompts are booked for the
// next start time. Awake outside the hours is a "session" the user chose (1, 2 or 4 hours), or, in the
// hour before the start time, a session that runs up to the start time. Quiet hours always win.
import { inQuiet } from './quiet.ts';
import { DAY_MINUTES, parseTime, windowLength } from './time.ts';
import type { Settings } from './types';

/** Prompts come at the start time, then one and two hours later. */
export const PROMPT_OFFSETS = [0, 60, 120] as const;
/** A prompt due this soon after the Asleep tap is skipped, so Asleep at 6:55 AM does not buzz at 7:00. */
export const PROMPT_MIN_GAP_MINUTES = 30;
/** Awake in this many minutes before the start time begins reminders at once, without a pop-up. */
export const GRACE_MINUTES = 60;
/** The spans the pop-up offers, in hours. */
export const SESSION_HOURS = [1, 2, 4] as const;
/** The first reminder of a session comes this long after the tap. */
export const SESSION_FIRST_MINUTES = 1;

/** What a wake-up prompt says: a greeting by the hour, then one line. No point text. */
export interface PromptText {
  morning: string;
  afternoon: string;
  evening: string;
  body: string;
}

const MINUTE = 60000;
const minuteOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** Is `at` inside the From to Until window? (Hours mode only; All-day has no window.) */
export function inWindow(settings: Settings, at: Date): boolean {
  if (settings.mode !== 'hours') return false;
  const a = parseTime(settings.from);
  const b = parseTime(settings.to);
  if (a === b) return false;
  const m = minuteOfDay(at);
  return a < b ? m >= a && m < b : m >= a || m < b;
}

/** The first start time (From) strictly after `after`, on the local clock. */
export function nextStart(settings: Settings, after: Date): Date {
  const start = parseTime(settings.from);
  for (let day = 0; day < 3; day++) {
    const d = new Date(after.getFullYear(), after.getMonth(), after.getDate() + day, 0, start);
    if (d.getTime() > after.getTime()) return d;
  }
  return new Date(after.getFullYear(), after.getMonth(), after.getDate() + 3, 0, start);
}

/** Moves a time out of quiet hours, to the first minute that is not quiet (null if every minute is quiet). */
function outOfQuiet(at: Date, settings: Settings): Date | null {
  let t = at;
  for (let i = 0; i <= DAY_MINUTES; i++) {
    if (!inQuiet(minuteOfDay(t), settings.quiet)) return t;
    t = new Date(t.getTime() + MINUTE);
  }
  return null;
}

/**
 * The prompts to book while Asleep: at the first start time after the Asleep tap, one hour and two hours
 * later. Only in Hours mode, only when the switch is on. They are tied to that one start time, so they are
 * never booked again for later mornings.
 */
export function planPrompts(settings: Settings, now: Date): Date[] {
  if (!settings.asleep || settings.mode !== 'hours' || !settings.morningPrompt) return [];
  const length = windowLength(settings.from, settings.to);
  if (length === 0) return [];
  const since = settings.asleepSince ? new Date(settings.asleepSince) : now;
  if (Number.isNaN(since.getTime())) return [];
  const base = nextStart(settings, since);
  const out: Date[] = [];
  const seen = new Set<number>();
  for (const offset of PROMPT_OFFSETS) {
    const at = outOfQuiet(new Date(base.getTime() + offset * MINUTE), settings);
    if (!at) continue;
    // Later than Until: dropped.
    if (at.getTime() - base.getTime() >= length * MINUTE) continue;
    if (at.getTime() - since.getTime() < PROMPT_MIN_GAP_MINUTES * MINUTE) continue;
    if (at.getTime() <= now.getTime()) continue;
    const key = Math.floor(at.getTime() / MINUTE);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(at);
  }
  return out;
}

/** "Good morning", "Good afternoon" or "Good evening" by the hour the prompt is due. */
export const greetingFor = (at: Date): 'morning' | 'afternoon' | 'evening' => (at.getHours() < 12 ? 'morning' : at.getHours() < 17 ? 'afternoon' : 'evening');

/** The reminder times of a session: one minute after it starts, then every `every` minutes, before it ends. */
export function sessionTimes(settings: Settings, now: Date, limit: number): Date[] {
  const s = settings.session;
  if (!s || settings.asleep || settings.mode !== 'hours') return [];
  const start = Date.parse(s.start);
  const end = Date.parse(s.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  const step = Math.max(15, settings.every) * MINUTE;
  const out: Date[] = [];
  for (let t = start + SESSION_FIRST_MINUTES * MINUTE; t < end && out.length < limit; t += step) {
    if (t <= now.getTime()) continue;
    const at = new Date(t);
    if (inQuiet(minuteOfDay(at), settings.quiet)) continue;
    out.push(at);
  }
  return out;
}

export type AwakeAction =
  /** Inside the hours, or All-day: reminders simply run. */
  | { kind: 'plain' }
  /** In the hour before the start time: reminders begin at once, up to the start time. */
  | { kind: 'grace'; session: { start: string; end: string } }
  /** Anywhere else: ask how long. `options` are the spans (hours) that would give at least one reminder. */
  | { kind: 'ask'; options: number[]; sessions: Record<number, { start: string; end: string }> };

/** What tapping Awake does at `now`. */
export function awakeAction(settings: Settings, now: Date): AwakeAction {
  if (settings.mode !== 'hours' || windowLength(settings.from, settings.to) === 0 || inWindow(settings, now)) return { kind: 'plain' };
  const first = nextStart(settings, now);
  const untilStart = (first.getTime() - now.getTime()) / MINUTE;
  const make = (end: Date) => ({ start: now.toISOString(), end: end.toISOString() });
  if (untilStart <= GRACE_MINUTES) return { kind: 'grace', session: make(first) };
  const step = Math.max(15, settings.every);
  const options: number[] = [];
  const sessions: Record<number, { start: string; end: string }> = {};
  const ends = new Set<number>();
  for (const h of SESSION_HOURS) {
    const end = new Date(Math.min(now.getTime() + h * 60 * MINUTE, first.getTime()));
    const span = (end.getTime() - now.getTime()) / MINUTE;
    if (span < step || ends.has(end.getTime())) continue;
    const session = make(end);
    if (sessionTimes({ ...settings, asleep: false, session }, new Date(now.getTime() - 1), 1).length === 0) continue;
    ends.add(end.getTime());
    options.push(h);
    sessions[h] = session;
  }
  return { kind: 'ask', options, sessions };
}

/** Asleep: nothing but prompts. Ends any session. */
export const goAsleep = (settings: Settings, now: Date): Settings => ({ ...settings, asleep: true, asleepSince: now.toISOString(), session: null });

/**
 * Awake: reminders resume. The grace hour starts its session at once; elsewhere the pop-up may add one.
 * Tapping Awake while already Awake leaves a running session alone.
 */
export function goAwake(settings: Settings, now: Date): Settings {
  const action = awakeAction(settings, now);
  const running = settings.asleep ? null : settings.session;
  return { ...settings, asleep: false, asleepSince: null, session: action.kind === 'grace' ? action.session : running };
}

/**
 * What tapping Awake does. Outside the hours (and not in the grace hour) nothing changes until the user
 * chooses a span in the pop-up, so "Not now" leaves an Asleep phone Asleep with its prompts.
 */
export function tapAwake(settings: Settings, now: Date): { settings: Settings; ask: Extract<AwakeAction, { kind: 'ask' }> | null } {
  const action = awakeAction(settings, now);
  if (action.kind === 'ask') return { settings, ask: action };
  return { settings: goAwake(settings, now), ask: null };
}

/** The user chose a span in the pop-up: Awake, with that session. */
export const startSession = (settings: Settings, session: { start: string; end: string }): Settings => ({ ...settings, asleep: false, asleepSince: null, session });

/** Today's whole-day count of reminder windows asleep, for shifting Daily points' last day. */
export function fullyAsleepDays(settings: Settings, since: Date, wakeAt: Date, createdAt: Date): number {
  const from = new Date(Math.max(since.getTime(), createdAt.getTime()));
  const allDay = settings.mode === 'button';
  const length = allDay ? DAY_MINUTES : windowLength(settings.from, settings.to);
  if (length === 0 || wakeAt.getTime() <= from.getTime()) return 0;
  const start = allDay ? 0 : parseTime(settings.from);
  let days = 0;
  for (let day = -1; ; day++) {
    const opens = new Date(from.getFullYear(), from.getMonth(), from.getDate() + day, 0, start);
    // Closing time on the local clock, so a daylight-saving change cannot shift it.
    const closesLocal = new Date(opens.getFullYear(), opens.getMonth(), opens.getDate(), 0, start + length);
    if (opens.getTime() >= wakeAt.getTime()) break;
    if (opens.getTime() >= from.getTime() && closesLocal.getTime() <= wakeAt.getTime()) days++;
  }
  return days;
}

/** A Daily point's new expiry (local midnight) moved later by `days` whole days. */
export function shiftExpiry(expiresAt: string, days: number): string {
  const end = new Date(expiresAt);
  return new Date(end.getFullYear(), end.getMonth(), end.getDate() + days).toISOString();
}

export type Status =
  | { kind: 'inHours'; until: string }
  | { kind: 'session'; until: Date }
  | { kind: 'waiting'; at: Date }
  | { kind: 'allDay' }
  | { kind: 'asleepPrompt'; at: Date }
  | { kind: 'asleepNone' };

/** What Home says about the state of reminders right now. */
export function statusFor(settings: Settings, now: Date): Status {
  if (settings.asleep) {
    const prompts = planPrompts(settings, now);
    return prompts.length > 0 ? { kind: 'asleepPrompt', at: prompts[0] } : { kind: 'asleepNone' };
  }
  if (settings.mode !== 'hours') return { kind: 'allDay' };
  if (inWindow(settings, now)) return { kind: 'inHours', until: settings.to };
  const s = settings.session;
  if (s && Date.parse(s.end) > now.getTime() && Date.parse(s.start) <= now.getTime()) {
    const end = new Date(s.end);
    // A session that ends at the start time hands over to the normal day: say so.
    return end.getTime() === nextStart(settings, new Date(s.start)).getTime() ? { kind: 'inHours', until: settings.to } : { kind: 'session', until: end };
  }
  return { kind: 'waiting', at: nextStart(settings, now) };
}
