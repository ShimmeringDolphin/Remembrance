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
