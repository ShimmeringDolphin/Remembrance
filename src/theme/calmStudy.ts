// Calm Study: warm paper by day, deep ink by night. Every colour the app uses comes from here.
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
}

export const light: Theme = {
  background: '#FAF7F0',
  surface: '#FFFFFF',
  text: '#23262F',
  muted: '#646A78',
  line: '#E4DFD3',
  accent: '#3B4A9C',
  onAccent: '#FFFFFF',
  soft: '#ECEEF8',
  scrim: 'rgba(20, 22, 30, 0.45)',
  sky: '#141A3A',
  star: '#F6E7B0',
};

export const dark: Theme = {
  background: '#14161D',
  surface: '#1E212B',
  text: '#ECEAE4',
  muted: '#A4A9B6',
  line: '#2F3340',
  accent: '#9AA8F0',
  onAccent: '#14161D',
  soft: '#262B3D',
  scrim: 'rgba(0, 0, 0, 0.6)',
  sky: '#0B0F24',
  star: '#F6E7B0',
};

export const themeFor = (scheme: string | null | undefined): Theme => (scheme === 'dark' ? dark : light);
