import type { ReviewAnswer, ReviewLogEntry } from '../core/types';
import { getDb } from './database';

/** Most recent entries read for insights; keeps memory small. */
export const MAX_LOG_READ = 1000;

export async function appendReview(entry: ReviewLogEntry): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO review_log (point_id, shown_at, answer) VALUES (?, ?, ?)', entry.pointId, entry.shownAt, entry.answer);
}

export async function recentReviews(limit: number = MAX_LOG_READ): Promise<ReviewLogEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ point_id: string; shown_at: string; answer: string }>(
    'SELECT point_id, shown_at, answer FROM review_log ORDER BY shown_at DESC LIMIT ?',
    limit,
  );
  return rows.map((r) => ({ pointId: r.point_id, shownAt: r.shown_at, answer: r.answer as ReviewAnswer }));
}
