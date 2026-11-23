// A time of day the way the phone writes it (7:00 AM or 07:00), for the lines on Home and in pop-ups.
export function clock(when: Date | string): string {
  let d: Date;
  if (typeof when === 'string') {
    const [h, m] = when.split(':').map(Number);
    d = new Date(2000, 0, 1, h, m);
  } else d = when;
  try {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
