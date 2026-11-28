// The shape of one star in the Sky look: a ten-point polygon (five tips and five dips), drawn the same everywhere.
export const INNER_RATIO = 0.46;

/** Points of a ten-point star centred on (cx, cy) with outer radius r, first tip straight up. */
export function starPoints(cx: number, cy: number, r: number): string {
  const out: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * INNER_RATIO;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    out.push(`${round(cx + radius * Math.cos(a))},${round(cy + radius * Math.sin(a))}`);
  }
  return out.join(' ');
}

const round = (n: number): number => Math.round(n * 100) / 100;

/** Home's star radius (7 to 14 px) from how often the point has come back, on the Sky's own log scale. */
export const homeRadius = (size: number): number => 7 + 7 * ((size - 0.15) / 0.85);

/** A star radius that keeps `count` stars apart on a line of `width`: at most `max`, at least 2.5. */
export const starRadius = (width: number, count: number, max: number): number =>
  count <= 1 || width <= 0 ? max : Math.max(2.5, Math.min(max, width / (count * 2.4)));

/** True when the closest two reminders on a line of `width` (fractions 0 to 1) sit under 8 px apart, too close to read as stars. */
export function tooCrowded(width: number, fracs: number[]): boolean {
  if (fracs.length < 2 || width <= 0) return false;
  const f = [...fracs].sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 1; i < f.length; i++) if (f[i] - f[i - 1] > 0) min = Math.min(min, f[i] - f[i - 1]);
  return min * width < 8;
}

/** Runs of reminders as {from, to} spans (0 to 1): neighbours join unless the gap is over 2.5 times the smallest gap, so quiet hours stay empty. */
export function threadSpans(fracs: number[]): { from: number; to: number }[] {
  if (fracs.length === 0) return [];
  const f = [...fracs].sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 1; i < f.length; i++) if (f[i] - f[i - 1] > 0) min = Math.min(min, f[i] - f[i - 1]);
  const out = [{ from: f[0], to: f[0] }];
  for (let i = 1; i < f.length; i++) {
    if (f[i] - f[i - 1] <= min * 2.5) out[out.length - 1].to = f[i];
    else out.push({ from: f[i], to: f[i] });
  }
  return out;
}
