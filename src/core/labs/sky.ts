// Experimental: deterministic star layout for the Memory Sky screen. Pure.
// Stars sit on a sunflower (golden-angle) spiral in creation order, so a new point appears at the
// edge and existing stars never move. Spacing is even by construction, so labels never pile up.
import type { Point } from '../types';

export interface StarPosition {
  pointId: string;
  /** 0 to 1 across the sky. */
  x: number;
  /** 0 to 1 down the sky. */
  y: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** More stars than this are not drawn; the list view stays the place for big collections. */
export const MAX_STARS = 60;

export function layoutSky(points: readonly Point[]): StarPosition[] {
  const ordered = [...points]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .slice(0, MAX_STARS);
  // Fix the scale for the largest possible sky so positions never change as points are added.
  const maxR = Math.sqrt(MAX_STARS);
  return ordered.map((p, i) => {
    const r = Math.sqrt(i + 0.5) / maxR; // 0 to 1
    const a = i * GOLDEN_ANGLE;
    return { pointId: p.id, x: 0.5 + 0.46 * r * Math.cos(a), y: 0.5 + 0.46 * r * Math.sin(a) };
  });
}
