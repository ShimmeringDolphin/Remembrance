// "Your sky": every point is a star that grows with each time it has appeared. It never dims, so
// there is nothing to lose. Pure layout and sizing.
import type { Point } from './types';

/** The sky shows up on the home screen once points have appeared this many times in total. */
export const SKY_UNLOCK_APPEARANCES = 30;
/** At this many appearances a star is full size. */
export const FULL_STAR_APPEARANCES = 200;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** 15 Daily plus 15 Long-term. */
const MAX_STARS = 30;

export interface Star {
  pointId: string;
  /** 0 to 1 across and down the sky. */
  x: number;
  y: number;
  /** 0.15 to 1: how grown the star is. */
  size: number;
}

/** Grows quickly at first, then slowly, so early days feel alive and nothing ever shrinks. */
export function starSize(appearances: number): number {
  const n = Math.max(0, appearances);
  return 0.15 + 0.85 * Math.min(1, Math.log1p(n) / Math.log1p(FULL_STAR_APPEARANCES));
}

/** Oldest point in the middle, newer ones further out; existing stars never move. */
export function layoutSky(points: readonly Point[]): Star[] {
  const ordered = points
    .filter((p) => p.status !== 'archived')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .slice(0, MAX_STARS);
  const maxR = Math.sqrt(MAX_STARS);
  return ordered.map((p, i) => {
    const r = Math.sqrt(i + 0.5) / maxR;
    const a = i * GOLDEN_ANGLE;
    return { pointId: p.id, x: 0.5 + 0.44 * r * Math.cos(a), y: 0.5 + 0.44 * r * Math.sin(a), size: starSize(p.timesShown) };
  });
}

export const totalAppearances = (points: readonly Point[]): number =>
  points.reduce((sum, p) => sum + (p.status === 'archived' ? 0 : p.timesShown), 0);

export const skyUnlocked = (points: readonly Point[]): boolean => totalAppearances(points) >= SKY_UNLOCK_APPEARANCES;
