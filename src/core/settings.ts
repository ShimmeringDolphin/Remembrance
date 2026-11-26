import { isRange, MAX_QUIET } from './quiet.ts';
import { isTime } from './time.ts';
import type { Language, Session, Settings } from './types';

/** Minutes between reminders the user can choose. 15 minutes is the shortest, to protect battery and goodwill. */
export const EVERY_CHOICES = [15, 30, 45, 60, 90, 120, 180] as const;
export const DEFAULT_EVERY = 60;
/** Older settings stored a named pace. */
const OLD_PACE: Record<string, number> = { often: 30, regular: 60, gentle: 120 };

export function defaultSettings(language: Language): Settings {
  return { from: '07:00', to: '22:00', every: DEFAULT_EVERY, asleep: false, mode: 'hours', quiet: [], privateMode: false, language, readAloud: false, englishInIndian: false, sound: false, asleepSince: null, session: null, morningPrompt: true };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStamp = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
function mergeSession(v: unknown): Session | null {
  if (!isObject(v) || !isStamp(v.start) || !isStamp(v.end) || Date.parse(v.end) <= Date.parse(v.start)) return null;
  return { start: v.start, end: v.end };
}
const isChoice = (v: unknown): v is number => typeof v === 'number' && (EVERY_CHOICES as readonly number[]).includes(v);

/** Settings from stored JSON. Anything missing or invalid falls back to the default, so old or damaged data never breaks the app. */
export function mergeSettings(stored: unknown, language: Language): Settings {
  const base = defaultSettings(language);
  if (!isObject(stored)) return base;
  const s = stored;
  const old = typeof s.pace === 'string' ? OLD_PACE[s.pace] : undefined;
  const asleep = typeof s.asleep === 'boolean' ? s.asleep : typeof s.paused === 'boolean' ? s.paused : base.asleep;
  return {
    from: isTime(s.from) ? s.from : base.from,
    to: isTime(s.to) ? s.to : base.to,
    every: isChoice(s.every) ? s.every : old ?? base.every,
    asleep,
    mode: s.mode === 'button' || s.mode === 'hours' ? s.mode : base.mode,
    quiet: Array.isArray(s.quiet) ? s.quiet.filter(isRange).slice(0, MAX_QUIET) : base.quiet,
    privateMode: typeof s.privateMode === 'boolean' ? s.privateMode : base.privateMode,
    language: s.language === 'en' || s.language === 'hi' || s.language === 'gu' ? s.language : base.language,
    readAloud: typeof s.readAloud === 'boolean' ? s.readAloud : base.readAloud,
    englishInIndian: typeof s.englishInIndian === 'boolean' ? s.englishInIndian : base.englishInIndian,
    sound: typeof s.sound === 'boolean' ? s.sound : base.sound,
    // Asleep without a recorded time keeps working: the prompts then count from the first rebook.
    asleepSince: asleep && isStamp(s.asleepSince) ? s.asleepSince : null,
    session: asleep ? null : mergeSession(s.session),
    morningPrompt: typeof s.morningPrompt === 'boolean' ? s.morningPrompt : base.morningPrompt,
  };
}

/** Reminders a day with these settings (before the booking cap). */
export function remindersPerDay(settings: Settings, windowMinutes: number): number {
  const length = settings.mode === 'button' ? 1440 : windowMinutes;
  return length <= 0 ? 0 : Math.ceil(length / settings.every);
}
