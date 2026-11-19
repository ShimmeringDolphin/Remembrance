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

export async function createPoint(input: {
  prompt: string;
  category: Category;
  language: Language;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO points (id, prompt, language, category, next_due_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    input.prompt.trim().slice(0, MAX_PROMPT_LENGTH),
    input.language,
    input.category,
    now,
    now,
    now,
  );
}

export async function updatePoint(
  id: string,
  input: { prompt: string; category: Category },
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE points SET prompt = ?, category = ?, updated_at = ? WHERE id = ?',
    input.prompt.trim().slice(0, MAX_PROMPT_LENGTH),
    input.category,
    new Date().toISOString(),
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
