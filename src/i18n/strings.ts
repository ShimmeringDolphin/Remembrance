import type { Language } from '../core/types';

// Hindi and Gujarati text is a first draft and needs review by a native speaker.
const strings = {
  en: {
    daily: 'Daily',
    longTerm: 'Long-term',
    addPoint: 'Add a point',
    editPoint: 'Edit point',
    pointPlaceholder: 'Write one short line to remember',
    save: 'Save',
    cancel: 'Cancel',
    archive: 'Archive',
    category: 'Category',
    emptyDaily: 'No daily points yet. Add what you are learning now.',
    emptyLongTerm: 'No long-term points yet. Move a daily point here when it is learned.',
  },
  hi: {
    daily: 'दैनिक',
    longTerm: 'दीर्घकालिक',
    addPoint: 'बिंदु जोड़ें',
    editPoint: 'बिंदु बदलें',
    pointPlaceholder: 'याद रखने के लिए एक छोटी पंक्ति लिखें',
    save: 'सहेजें',
    cancel: 'रद्द करें',
    archive: 'संग्रहित करें',
    category: 'श्रेणी',
    emptyDaily: 'अभी कोई दैनिक बिंदु नहीं है। जो अभी सीख रहे हैं, वह जोड़ें।',
    emptyLongTerm: 'अभी कोई दीर्घकालिक बिंदु नहीं है। याद हो जाने पर दैनिक बिंदु यहाँ लाएँ।',
  },
  gu: {
    daily: 'દૈનિક',
    longTerm: 'લાંબા ગાળાના',
    addPoint: 'મુદ્દો ઉમેરો',
    editPoint: 'મુદ્દો બદલો',
    pointPlaceholder: 'યાદ રાખવા માટે એક ટૂંકી લીટી લખો',
    save: 'સાચવો',
    cancel: 'રદ કરો',
    archive: 'આર્કાઇવ કરો',
    category: 'શ્રેણી',
    emptyDaily: 'હજી કોઈ દૈનિક મુદ્દો નથી. હમણાં જે શીખો છો તે ઉમેરો.',
    emptyLongTerm: 'હજી કોઈ લાંબા ગાળાનો મુદ્દો નથી. યાદ થઈ જાય ત્યારે દૈનિક મુદ્દો અહીં લાવો.',
  },
} as const;

export type Strings = Record<keyof (typeof strings)['en'], string>;

/** Picks the app language from the device locale; English if unsupported. */
export function detectLanguage(): Language {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  if (locale.startsWith('hi')) return 'hi';
  if (locale.startsWith('gu')) return 'gu';
  return 'en';
}

export function getStrings(language: Language): Strings {
  return strings[language];
}
