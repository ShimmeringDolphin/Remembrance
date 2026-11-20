import type { Category, Frequency, Language, NotificationStyle, Point, PointKind, PointStatus } from '../core/types';
import { MAX_POINTS_PER_CATEGORY } from '../core/limits';
import { getDb } from './database';

interface PointRow {
  id: string;
  kind: string;
  prompt: string;
  answer: string | null;
  detail: string | null;
  language: string;
  category: string;
  tags: string;
  status: string;
  frequency: string;
  next_due_at: string;
  speak: number;
  private: number;
  notification_style: string | null;
  created_at: string;
  updated_at: string;
  last_shown_at: string | null;
  times_shown: number;
  times_remembered: number;
}

function toPoint(r: PointRow): Point {
  return {
    id: r.id,
    kind: r.kind as PointKind,
    prompt: r.prompt,
    answer: r.answer,
    detail: r.detail,
    language: r.language as Language,
    category: r.category as Category,
    tags: JSON.parse(r.tags) as string[],
    status: r.status as PointStatus,
    frequency: JSON.parse(r.frequency) as Frequency,
    nextDueAt: r.next_due_at,
    speak: r.speak === 1,
    private: r.private === 1,
    notificationStyle: r.notification_style as NotificationStyle | null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastShownAt: r.last_shown_at,
    timesShown: r.times_shown,
    timesRemembered: r.times_remembered,
  };
}

/** Random id, good enough for local-only rows. */
function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const MAX_PROMPT_LENGTH = 280;

/** Active and paused points of one category, newest first. */
export async function listPoints(category: Category): Promise<Point[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PointRow>(
    "SELECT * FROM points WHERE category = ? AND status != 'archived' ORDER BY created_at DESC",
    category,
  );
  return rows.map(toPoint);
}

/** All active points of both categories, for planning reminders. */
export async function listActivePoints(): Promise<Point[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PointRow>("SELECT * FROM points WHERE status = 'active'");
  return rows.map(toPoint);
}

/** Points per category that are not archived, and every point ever kept (any status). */
export async function countPoints(): Promise<{ daily: number; long_term: number; total: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ daily: number; long_term: number; total: number }>(
    `SELECT
       SUM(CASE WHEN category = 'daily' AND status != 'archived' THEN 1 ELSE 0 END) AS daily,
       SUM(CASE WHEN category = 'long_term' AND status != 'archived' THEN 1 ELSE 0 END) AS long_term,
       COUNT(*) AS total
     FROM points`,
  );
  return { daily: row?.daily ?? 0, long_term: row?.long_term ?? 0, total: row?.total ?? 0 };
}

/**
 * Adds a point unless its category already holds MAX_POINTS_PER_CATEGORY points. The check and
 * the insert are one statement, so two quick saves cannot slip past the limit.
 * Returns false when the category is full.
 */
export async function createPoint(input: {
  prompt: string;
  category: Category;
  language: Language;
}): Promise<boolean> {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO points (id, prompt, language, category, next_due_at, created_at, updated_at)
     SELECT ?, ?, ?, ?, ?, ?, ?
     WHERE (SELECT COUNT(*) FROM points WHERE category = ? AND status != 'archived') < ?`,
    newId(),
    input.prompt.trim().slice(0, MAX_PROMPT_LENGTH),
    input.language,
    input.category,
    now,
    now,
    now,
    input.category,
    MAX_POINTS_PER_CATEGORY,
  );
  return result.changes > 0;
}

/** Saves an edit. Moving a point into a full category is refused (returns false); text edits always save. */
export async function updatePoint(
  id: string,
  input: { prompt: string; category: Category },
): Promise<boolean> {
  const db = await getDb();
  const result = await db.runAsync(
    `UPDATE points SET prompt = ?, category = ?, updated_at = ?
     WHERE id = ? AND (
       category = ?
       OR (SELECT COUNT(*) FROM points WHERE category = ? AND status != 'archived') < ?
     )`,
    input.prompt.trim().slice(0, MAX_PROMPT_LENGTH),
    input.category,
    new Date().toISOString(),
    id,
    input.category,
    input.category,
    MAX_POINTS_PER_CATEGORY,
  );
  return result.changes > 0;
}

/** Adds counted appearances to each point, all in one transaction. */
export async function addAppearances(counts: ReadonlyMap<string, number>, lastAt: ReadonlyMap<string, string>): Promise<void> {
  if (counts.size === 0) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const [id, n] of counts) {
      await db.runAsync(
        'UPDATE points SET times_shown = times_shown + ?, last_shown_at = ? WHERE id = ?',
        n,
        lastAt.get(id) ?? null,
        id,
      );
    }
  });
}

/** Archived points stay in the database but never remind. */
export async function archivePoint(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE points SET status = 'archived', updated_at = ? WHERE id = ?",
    new Date().toISOString(),
    id,
  );
}

/** Most points one Review now screen loads, so memory stays small. */
export const MAX_REVIEW_POINTS = 50;

/** Active points for Review now. With ids, only those (a tapped reminder); otherwise the newest ones. */
export async function listForReview(ids?: readonly string[]): Promise<Point[]> {
  const db = await getDb();
  if (ids && ids.length > 0) {
    const wanted = ids.slice(0, MAX_REVIEW_POINTS);
    // Only "?" marks are built here; the ids themselves are bound, never put into the SQL text.
    const marks = wanted.map(() => '?').join(', ');
    const rows = await db.getAllAsync<PointRow>(
      `SELECT * FROM points WHERE status = 'active' AND id IN (${marks}) ORDER BY created_at DESC`,
      ...wanted,
    );
    return rows.map(toPoint);
  }
  const rows = await db.getAllAsync<PointRow>(
    "SELECT * FROM points WHERE status = 'active' ORDER BY created_at DESC LIMIT ?",
    MAX_REVIEW_POINTS,
  );
  return rows.map(toPoint);
}
/** Archived points, most recently archived first. */
export async function listArchived(): Promise<Point[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PointRow>(
    "SELECT * FROM points WHERE status = 'archived' ORDER BY updated_at DESC",
  );
  return rows.map(toPoint);
}

/** Brings an archived point back as active, unless its category is full (returns false). */
export async function restorePoint(id: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.runAsync(
    `UPDATE points SET status = 'active', updated_at = ?
     WHERE id = ? AND status = 'archived'
       AND (SELECT COUNT(*) FROM points AS p WHERE p.category = points.category AND p.status != 'archived') < ?`,
    new Date().toISOString(),
    id,
    MAX_POINTS_PER_CATEGORY,
  );
  return result.changes > 0;
}

/** Permanently removes an archived point. Only archived points can be deleted. */
export async function deleteArchivedPoint(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM points WHERE id = ? AND status = 'archived'", id);
}
