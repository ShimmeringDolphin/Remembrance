// Experimental: turns a gap in minutes into a unit and a rounded number; the UI adds translated text.
export interface GapParts {
  unit: 'minute' | 'hour' | 'day';
  n: number;
}

export function gapParts(minutes: number): GapParts {
  if (minutes < 90) return { unit: 'minute', n: Math.max(1, Math.round(minutes)) };
  if (minutes < 2880) return { unit: 'hour', n: Math.round(minutes / 60) };
  return { unit: 'day', n: Math.round(minutes / 1440) };
}
