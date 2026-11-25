// Which voice should read a point? Chosen from the letters in the point itself, so a Hindi or Gujarati point
// is read in Hindi or Gujarati even when the app is in English. Pure: no I/O.
import type { Language } from './types';

const DEVANAGARI = /[ऀ-ॿ]/g;
const GUJARATI = /[઀-૿]/g;
const LATIN = /[A-Za-z]/g;

/** The language of a point's text by its letters: the script with the most letters wins, `fallback` if there are none. */
export function languageOf(text: string, fallback: Language): Language {
  const hi = (text.match(DEVANAGARI) ?? []).length;
  const gu = (text.match(GUJARATI) ?? []).length;
  const en = (text.match(LATIN) ?? []).length;
  if (hi === 0 && gu === 0 && en === 0) return fallback;
  if (hi > gu && hi > en) return 'hi';
  if (gu > hi && gu > en) return 'gu';
  if (en > hi && en > gu) return 'en';
  return fallback;
}
