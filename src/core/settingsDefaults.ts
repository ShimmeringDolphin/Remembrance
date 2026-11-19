import type { Frequency, Language, Settings, TimeRange } from './types';

export function defaultSettings(language: Language): Settings {
  return {
    defaultFrequency: { mode: 'interval', everyMinutes: 60 },
    activeHours: { start: '07:00', end: '22:00' },
    activeMode: 'hours',
    awake: true,
    quietHours: [],
    appLanguage: language,
    speechRate: 1,
    delivery: { notification: true, widget: false, voice: false },
    appLock: { enabled: false, timeoutSeconds: 60 },
    notificationStyle: 'grouped',
    privateNotifications: false,
  };
}

const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const isTime = (v: unknown): v is string => typeof v === 'string' && TIME.test(v);
const isRange = (v: unknown): v is TimeRange =>
  typeof v === 'object' && v !== null && isTime((v as TimeRange).start) && isTime((v as TimeRange).end);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function pickFrequency(v: unknown, fallback: Settings['defaultFrequency']): Settings['defaultFrequency'] {
  if (!isObject(v)) return fallback;
  const f = v as unknown as Frequency;
  if (f.mode === 'interval' && Number.isFinite(f.everyMinutes) && f.everyMinutes > 0) return f;
  if (f.mode === 'per_day' && Number.isFinite(f.timesPerDay) && f.timesPerDay >= 1) return f;
  return fallback;
}

/**
 * Builds settings from stored JSON. Unknown or invalid fields fall back to the defaults, so a
 * damaged or older record never breaks the app.
 */
export function mergeSettings(stored: unknown, language: Language): Settings {
  const base = defaultSettings(language);
  if (!isObject(stored)) return base;
  const s = stored;
  return {
    defaultFrequency: pickFrequency(s.defaultFrequency, base.defaultFrequency),
    activeHours: isRange(s.activeHours) ? s.activeHours : base.activeHours,
    activeMode: s.activeMode === 'button_only' || s.activeMode === 'hours' ? s.activeMode : base.activeMode,
    awake: typeof s.awake === 'boolean' ? s.awake : base.awake,
    quietHours: Array.isArray(s.quietHours) ? s.quietHours.filter(isRange) : base.quietHours,
    appLanguage: s.appLanguage === 'en' || s.appLanguage === 'hi' || s.appLanguage === 'gu' ? s.appLanguage : base.appLanguage,
    speechRate: typeof s.speechRate === 'number' && s.speechRate > 0 ? s.speechRate : base.speechRate,
    delivery: base.delivery,
    appLock: base.appLock,
    notificationStyle: s.notificationStyle === 'individual' || s.notificationStyle === 'grouped' ? s.notificationStyle : base.notificationStyle,
    privateNotifications: typeof s.privateNotifications === 'boolean' ? s.privateNotifications : base.privateNotifications,
  };
}
