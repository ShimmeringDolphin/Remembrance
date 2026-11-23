// Calm Study: warm paper by day, deep ink by night. Every colour the app uses comes from here.
// Daily points are marigold and Long-term points are peacock, everywhere they appear.
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
  /** Text on a moment card (cards keep a light ground in both themes). */
  cardText: string;
}

export const light: Theme = {
  background: '#F7F5EF',
  surface: '#FFFFFF',
  text: '#1F2230',
  muted: '#5E6372',
  line: '#E2DED3',
  accent: '#3B4A9C',
  onAccent: '#FFFFFF',
  soft: '#ECEEF8',
  scrim: 'rgba(20, 22, 30, 0.45)',
  sky: '#121733',
  star: '#F6E7B0',
  skyText: '#D9DCF0',
  daily: '#BC8236',
  dailySoft: '#F6EEE0',
  longTerm: '#1E6B74',
  longTermSoft: '#DCEFF0',
  cardText: '#1F2230',
};

export const dark: Theme = {
  background: '#14161D',
  surface: '#1D2029',
  text: '#ECEAE4',
  muted: '#A4A9B6',
  line: '#2C303C',
  accent: '#9AA8F0',
  onAccent: '#14161D',
  soft: '#262B3D',
  scrim: 'rgba(0, 0, 0, 0.6)',
  sky: '#0B0F24',
  star: '#F6E7B0',
  skyText: '#D9DCF0',
  daily: '#DDA75E',
  dailySoft: '#352B1C',
  longTerm: '#4FB3BD',
  longTermSoft: '#123235',
  cardText: '#ECEAE4',
};

export const themeFor = (scheme: string | null | undefined): Theme => (scheme === 'dark' ? dark : light);

export const tint = (theme: Theme, c: Category) => (c === 'daily' ? theme.daily : theme.longTerm);
export const tintSoft = (theme: Theme, c: Category) => (c === 'daily' ? theme.dailySoft : theme.longTermSoft);

/** Android notification accent colour for a reminder. */
export const categoryColour = (c: Category) => (c === 'daily' ? light.daily : light.longTerm);

/** The Sky symbol: three stars that dim with distance. Cream in front, bronze behind, dusky violet furthest back. */
export const SKY_MARK = { five: '#FFF3C4', four: '#8E6D47', three: '#454377' } as const;
