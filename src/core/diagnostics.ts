// Test-build panel: reads back what the phone holds, so a person can see it without waiting overnight.
// Only counts and times: never point text.

/** The due times of the booked reminders, soonest first. Entries without a readable time are ignored. */
export function bookedTimes(dues: unknown[]): Date[] {
  const out: Date[] = [];
  for (const d of dues) {
    if (typeof d !== 'string') continue;
    const t = new Date(d);
    if (!Number.isNaN(t.getTime())) out.push(t);
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}
