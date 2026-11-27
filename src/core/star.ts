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
