// The day line on Home: today's reminders as stars on a line, from the first to the last, with a marker for now.
// Pure: drawn from the saved settings by the same planner that books the reminders, so it shows no timer and books nothing.
import { planTimes } from './planner.ts';
import type { Settings } from './types';

export interface DayLine {
  /** Each of today's reminders, as a place on the line (0 = first, 1 = last) and whether it has already come. */
  stars: { frac: number; past: boolean; at: Date }[];
  /** Where now sits on the line (0 to 1), moved only when the screen is drawn. */
  now: number;
  first: Date;
  last: Date;
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Null while Asleep or when nothing is planned today (a gap in quiet hours shows as a wider space between stars). */
export function dayLine(settings: Settings, now: Date): DayLine | null {
  if (settings.asleep) return null;
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const times = planTimes({ ...settings, asleep: false }, new Date(dayStart.getTime() - 1), 400).filter((d) => sameDay(d, now));
  if (times.length === 0) return null;
  const first = times[0];
  const last = times[times.length - 1];
  const span = last.getTime() - first.getTime();
  const place = (d: Date) => (span === 0 ? 0.5 : Math.min(1, Math.max(0, (d.getTime() - first.getTime()) / span)));
  return {
    stars: times.map((at) => ({ at, frac: place(at), past: at.getTime() <= now.getTime() })),
    now: place(now),
    first,
    last,
  };
}
