// Which font family draws a piece of text. Headings use Baloo 2 and body text Hind; Gujarati uses their Gujarati
// cousins (Baloo Bhai 2 and Hind Vadodara). Hindi and English share Baloo 2 and Hind, which cover Devanagari and Latin.
// Pure: no React Native imports, so the mapping is tested under Node.
import type { Language } from '../core/types';

export type FontRole = 'heading' | 'semibold' | 'body';

/** The font family names registered in `fontFiles.ts`. */
export const FAMILY: Record<Language, Record<FontRole, string>> = {
  en: { heading: 'Baloo2_700Bold', semibold: 'Hind_600SemiBold', body: 'Hind_400Regular' },
  hi: { heading: 'Baloo2_700Bold', semibold: 'Hind_600SemiBold', body: 'Hind_400Regular' },
  gu: { heading: 'BalooBhai2_700Bold', semibold: 'HindVadodara_600SemiBold', body: 'HindVadodara_400Regular' },
};

/** Custom fonts have one file per weight, so the CSS weight of a style picks the role. */
export function roleOfWeight(weight: string | number | undefined): FontRole {
  const w = weight === 'bold' ? 700 : typeof weight === 'string' ? parseInt(weight, 10) : weight;
  if (typeof w !== 'number' || !Number.isFinite(w)) return 'body';
  return w >= 700 ? 'heading' : w >= 600 ? 'semibold' : 'body';
}

export const familyFor = (language: Language, weight: string | number | undefined): string => FAMILY[language][roleOfWeight(weight)];

/** A bundled font set: Latin and Devanagari share one, Gujarati has its own (it covers Latin too). */
export type FontSet = 'lat' | 'gu';
export const setOfLanguage = (language: Language): FontSet => (language === 'gu' ? 'gu' : 'lat');

export interface FontRun {
  text: string;
  set: FontSet;
}

/**
 * Splits a point's text so each part is drawn in a font that has its letters: Gujarati letters in the Gujarati set,
 * Devanagari in the other, and Latin letters in the set of the app language. Spaces, digits and punctuation stay with
 * the run they follow. A text with no letters is one run in the app language's set.
 */
export function fontRuns(text: string, appLanguage: Language): FontRun[] {
  const own = setOfLanguage(appLanguage);
  const setOfChar = (ch: string): FontSet | null => (/[઀-૿]/.test(ch) ? 'gu' : /[ऀ-ॿ]/.test(ch) ? 'lat' : /[A-Za-z]/.test(ch) ? own : null);
  const runs: FontRun[] = [];
  let lead = '';
  for (const ch of text) {
    const s = setOfChar(ch);
    const last = runs[runs.length - 1];
    if (s === null) {
      if (last) last.text += ch;
      else lead += ch;
    } else if (last && last.set === s) last.text += ch;
    else runs.push({ text: (runs.length === 0 ? lead : '') + ch, set: s });
  }
  return runs.length === 0 ? [{ text, set: own }] : runs;
}

/** The sets other than the app language's that these texts need loaded. */
export function extraSetsNeeded(texts: readonly string[], appLanguage: Language): FontSet[] {
  const own = setOfLanguage(appLanguage);
  const other: FontSet = own === 'gu' ? 'lat' : 'gu';
  return texts.some((t) => fontRuns(t, appLanguage).some((r) => r.set === other)) ? [other] : [];
}

export const familyOfSet = (set: FontSet, weight: string | number | undefined): string => familyFor(set === 'gu' ? 'gu' : 'en', weight);
