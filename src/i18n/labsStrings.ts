// Experimental (open-creativity): strings for the lab screens. Fold into strings.ts if promoted.
// Hindi and Gujarati are first drafts and need review by a native speaker.
import type { Language } from '../core/types';

const labsStrings = {
  en: { skyTitle: 'Memory Sky', skyHint: 'Brighter stars are better remembered.', skyRecall: '{n}% remembered', skyEmpty: 'Add a point and it will appear as a star.' },
  hi: { skyTitle: 'स्मृति आकाश', skyHint: 'जो तारा जितना चमकीला, वह उतना अच्छा याद है।', skyRecall: '{n}% याद', skyEmpty: 'एक मुद्दा जोड़ें, वह तारे के रूप में दिखेगा।' },
  gu: { skyTitle: 'સ્મૃતિ આકાશ', skyHint: 'જે તારો વધુ ચમકે તે વધુ સારો યાદ છે.', skyRecall: '{n}% યાદ', skyEmpty: 'એક મુદ્દો ઉમેરો, તે તારા તરીકે દેખાશે.' },
} as const;

export type LabsStrings = Record<keyof (typeof labsStrings)['en'], string>;
export const getLabsStrings = (language: Language): LabsStrings => labsStrings[language];
