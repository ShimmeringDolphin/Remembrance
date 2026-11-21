import { isDateKey, localDateKey } from '../core/dailyRepeat';
import type { Category, Frequency, Language, NotificationStyle, Point, PointKind, PointStatus } from '../core/types';
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
  repeat_until: string | null;
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
    repeatUntil: isDateKey(r.repeat_until) ? r.repeat_until : null,
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

/** Long-term points never have a last day; a bad value is stored as no end. */
function cleanRepeatUntil(category: Category, repeatUntil: string | null): string | null {
  return category === 'daily' && isDateKey(repeatUntil) ? repeatUntil : null;
}

export async function createPoint(input: {
  prompt: string;
  category: Category;
  language: Language;
  repeatUntil: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO points (id, prompt, language, category, repeat_until, next_due_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    input.prompt.trim().slice(0, MAX_PROMPT_LENGTH),
    input.language,
    input.category,
    cleanRepeatUntil(input.category, input.repeatUntil),
    now,
    now,
    now,
  );
}

export async function updatePoint(
  id: string,
  input: { prompt: string; category: Category; repeatUntil: string | null },
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE points SET prompt = ?, category = ?, repeat_until = ?, updated_at = ? WHERE id = ?',
    input.prompt.trim().slice(0, MAX_PROMPT_LENGTH),
    input.category,
    cleanRepeatUntil(input.category, input.repeatUntil),
    new Date().toISOString(),
    id,
  );
}

/**
 * Archives active points whose last day is before `today`. Runs on app open, in one statement,
 * so nothing has to run in the background. Returns how many were archived.
 */
export async function archiveExpiredPoints(today: Date): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `UPDATE points SET status = 'archived', updated_at = ?
     WHERE status = 'active' AND repeat_until IS NOT NULL AND repeat_until < ?`,
    new Date().toISOString(),
    localDateKey(today),
  );
  return result.changes;
}

/** Archived points of both categories, most recently archived first. */
export async function listArchivedPoints(): Promise<Point[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PointRow>(
    "SELECT * FROM points WHERE status = 'archived' ORDER BY updated_at DESC",
  );
  return rows.map(toPoint);
}

/**
 * Brings an archived point back so it reminds again. A daily point whose last day has passed gets
 * today as its new last day (edit it to repeat for longer), so it is not archived again at once.
 */
export async function restorePoint(id: string): Promise<void> {
  const db = await getDb();
  const today = localDateKey(new Date());
  await db.runAsync(
    `UPDATE points SET status = 'active', updated_at = ?,
       repeat_until = CASE WHEN repeat_until IS NOT NULL AND repeat_until < ? THEN ? ELSE repeat_until END
     WHERE id = ? AND status = 'archived'`,
    new Date().toISOString(),
    today,
    today,
    id,
  );
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
