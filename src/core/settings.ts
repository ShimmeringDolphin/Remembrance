import { isTime } from './time.ts';
import type { Language, Pace, Settings } from './types';

export const PACE_MINUTES: Record<Pace, number> = { often: 30, regular: 60, gentle: 120 };

export function defaultSettings(language: Language): Settings {
  return { from: '07:00', to: '22:00', pace: 'regular', paused: false, privateMode: false, language };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Settings from stored JSON. Anything missing or invalid falls back to the default, so old or damaged data never breaks the app. */
export function mergeSettings(stored: unknown, language: Language): Settings {
  const base = defaultSettings(language);
  if (!isObject(stored)) return base;
  const s = stored;
  return {
    from: isTime(s.from) ? s.from : base.from,
    to: isTime(s.to) ? s.to : base.to,
    pace: s.pace === 'often' || s.pace === 'regular' || s.pace === 'gentle' ? s.pace : base.pace,
    paused: typeof s.paused === 'boolean' ? s.paused : base.paused,
    privateMode: typeof s.privateMode === 'boolean' ? s.privateMode : base.privateMode,
    language: s.language === 'en' || s.language === 'hi' || s.language === 'gu' ? s.language : base.language,
  };
}
