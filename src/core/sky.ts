// "Your sky": each point is a star that grows with every appearance and never dims.
import type { Point } from './types';

export const SKY_UNLOCK = 30;
/** Development builds (Expo Go testing) open the sky after this many reminders instead. */
export const TEST_SKY_UNLOCK_REMINDERS = 3;
export const FULL_STAR = 200;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MAX_STARS = 30;

export interface Star {
  pointId: string;
  x: number; // 0..1
  y: number; // 0..1
  size: number; // 0.15..1
}

export const starSize = (appearances: number): number =>
  0.15 + 0.85 * Math.min(1, Math.log1p(Math.max(0, appearances)) / Math.log1p(FULL_STAR));

/** Oldest point at the centre, newer ones further out; stars never move once placed. */
export function layoutSky(points: readonly Point[]): Star[] {
  const live = points
    .filter((p) => !p.archived)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .slice(0, MAX_STARS);
  const maxR = Math.sqrt(MAX_STARS);
  return live.map((p, i) => {
    const r = Math.sqrt(i + 0.5) / maxR;
    const a = i * GOLDEN_ANGLE;
    return { pointId: p.id, x: 0.5 + 0.44 * r * Math.cos(a), y: 0.5 + 0.44 * r * Math.sin(a), size: starSize(p.appearances) };
  });
}

export const totalAppearances = (points: readonly Point[]): number =>
  points.reduce((s, p) => s + (p.archived ? 0 : p.appearances), 0);

/** The sky opens at 30 appearances; while testing, after 3 reminders have passed. */
export const skyUnlocked = (points: readonly Point[], remindersPassed: number, testing: boolean): boolean =>
  totalAppearances(points) >= SKY_UNLOCK || (testing && remindersPassed >= TEST_SKY_UNLOCK_REMINDERS);

/** Thin lines joining the stars of one category, oldest to newest. Only categories with two or more stars have a line. */
export function skyThreads(stars: readonly Star[], points: readonly Point[]): { category: Point['category']; ids: string[] }[] {
  const byId = new Map(points.map((p) => [p.id, p]));
  return (['daily', 'long_term'] as const)
    .map((category) => ({ category, ids: stars.filter((s) => byId.get(s.pointId)?.category === category).map((s) => s.pointId) }))
    .filter((t) => t.ids.length >= 2);
}
