// The bundled font files, keyed by the family names in `fonts.ts`. Only the set for the app language is loaded.
import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2/700Bold';
import { BalooBhai2_700Bold } from '@expo-google-fonts/baloo-bhai-2/700Bold';
import { Hind_400Regular } from '@expo-google-fonts/hind/400Regular';
import { Hind_600SemiBold } from '@expo-google-fonts/hind/600SemiBold';
import { HindVadodara_400Regular } from '@expo-google-fonts/hind-vadodara/400Regular';
import { HindVadodara_600SemiBold } from '@expo-google-fonts/hind-vadodara/600SemiBold';

import type { Language } from '../core/types';

const LATIN_DEVANAGARI = { Baloo2_700Bold, Hind_400Regular, Hind_600SemiBold };
const GUJARATI = { BalooBhai2_700Bold, HindVadodara_400Regular, HindVadodara_600SemiBold };

export const fontFilesFor = (language: Language) => (language === 'gu' ? GUJARATI : LATIN_DEVANAGARI);
