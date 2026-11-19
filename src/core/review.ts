// Pure helpers for the Review now screen. No Expo or React Native imports (see CLAUDE.md).
import type { Point } from './types';

/** Most point ids a single reminder can carry into Review; anything beyond is ignored. */
export const MAX_REVIEW_IDS = 200;

/**
 * Reads the point ids from a tapped notification's data. The data comes back from the OS, so its
 * shape is checked rather than trusted. Returns null when it is not one of our reminders.
 */
export function pointIdsFromNotificationData(data: unknown): string[] | null {
  if (typeof data !== 'object' || data === null) return null;
  const ids = (data as { pointIds?: unknown }).pointIds;
  if (!Array.isArray(ids)) return null;
  const valid = ids.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64);
  if (valid.length === 0) return null;
  return [...new Set(valid)].slice(0, MAX_REVIEW_IDS);
}

/**
 * Points to show in Review, in the order of `ids`. Points archived or deleted since the reminder
 * was booked are left out. With `ids` null (opened from the app), every given point is shown.
 */
export function pickReviewPoints(points: readonly Point[], ids: readonly string[] | null): Point[] {
  const active = points.filter((p) => p.status === 'active');
  if (ids === null) return active;
  const byId = new Map(active.map((p) => [p.id, p]));
  return ids.flatMap((id) => {
    const p = byId.get(id);
    return p ? [p] : [];
  });
}
