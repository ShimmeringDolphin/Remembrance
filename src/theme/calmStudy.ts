// Calm Study, Sky look: mist by day, deep teal-night by night. Every colour the app uses comes from here.
// Daily points are haldi (turmeric gold) and Long-term points are peacock, everywhere they appear.
import type { Category } from '../core/types';

export interface Theme {
  background: string;
  surface: string;
  text: string;
  muted: string;
  line: string;
  accent: string;
  onAccent: string;
  soft: string;
  scrim: string;
  sky: string;
  star: string;
  skyText: string;
  daily: string;
  dailySoft: string;
  longTerm: string;
  longTermSoft: string;
  /** Segmented controls and switch tracks. */
  chip: string;
  /** The day line and idle strokes. */
  thread: string;
  /** Text in the Daily / Long-term colour (the fill colours are too light for text). */
  dailyInk: string;
  longInk: string;
  /** Main buttons are plain ink; `onButton` is the text on them. */
  button: string;
  onButton: string;
  /** Text on a button or chip filled with the Daily / Long-term colour. */
  onDaily: string;
  onLong: string;
  /** A card on the Sky page. */
  skyCard: string;
  /** Text on a moment card (cards keep a light ground in both themes). */
  cardText: string;
}

export const light: Theme = {
  background: '#EEF2F1',
  surface: '#FFFFFF',
  text: '#15212B',
  muted: '#4B5965',
  line: '#D2DCDA',
  accent: '#0F6F75',
  onAccent: '#FFFFFF',
  soft: '#E0E7E5',
  scrim: 'rgba(20, 22, 30, 0.45)',
  sky: '#101A33',
  star: '#F6E7B0',
  skyText: '#D9DCF0',
  daily: '#E0A030',
  dailySoft: '#FBEFD6',
  longTerm: '#0F6F75',
  longTermSoft: '#DCEFEE',
  chip: '#E0E7E5',
  thread: '#B9C6C4',
  dailyInk: '#8A5800',
  longInk: '#0F6F75',
  button: '#15212B',
  onButton: '#FFFFFF',
  onDaily: '#15212B',
  onLong: '#FFFFFF',
  skyCard: '#1C2848',
  cardText: '#15212B',
};

export const dark: Theme = {
  background: '#0D1519',
  surface: '#16222A',
  text: '#E6EEEC',
  muted: '#9DACB2',
  line: '#26343C',
  accent: '#6CCFD1',
  onAccent: '#0D1519',
  soft: '#1C2A32',
  scrim: 'rgba(0, 0, 0, 0.6)',
  sky: '#070C1C',
  star: '#F6E7B0',
  skyText: '#D9DCF0',
  daily: '#F0B451',
  dailySoft: '#2E2614',
  longTerm: '#3DB6B9',
  longTermSoft: '#10302F',
  chip: '#1C2A32',
  thread: '#33454E',
  dailyInk: '#F3C77A',
  longInk: '#6CCFD1',
  button: '#E6EEEC',
  onButton: '#0D1519',
  onDaily: '#0D1519',
  onLong: '#0D1519',
  skyCard: '#131B33',
  cardText: '#E6EEEC',
};

export const themeFor = (scheme: string | null | undefined): Theme => (scheme === 'dark' ? dark : light);

export const tint = (theme: Theme, c: Category) => (c === 'daily' ? theme.daily : theme.longTerm);
/** Ink for text in a category's colour, and the text colour for a fill of it. */
export const tintInk = (theme: Theme, c: Category) => (c === 'daily' ? theme.dailyInk : theme.longInk);
export const onTint = (theme: Theme, c: Category) => (c === 'daily' ? theme.onDaily : theme.onLong);
export const tintSoft = (theme: Theme, c: Category) => (c === 'daily' ? theme.dailySoft : theme.longTermSoft);

/** Android notification accent colour for a reminder. */
export const categoryColour = (c: Category) => (c === 'daily' ? light.daily : light.longTerm);

/** The Sky symbol: three stars that dim with distance. Cream in front, bronze behind, dusky violet furthest back. */
export const SKY_MARK = { five: '#FFF3C4', four: '#8E6D47', three: '#454377' } as const;
