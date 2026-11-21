// The only place that talks to SQLite. Every query binds its values; no SQL is built from user text.
// Points are stored unencrypted on the device (no SQLCipher yet).
import * as SQLite from 'expo-sqlite';

import type { Booked } from '../core/appearances';
import { MAX_PER_CATEGORY } from '../core/limits';
import type { Category, Point } from '../core/types';

let opened: Promise<SQLite.SQLiteDatabase> | null = null;

/** Versioned migrations, applied in order using PRAGMA user_version. Never edit one that has shipped. */
const MIGRATIONS: string[] = [
  // 1: points, plus a small key-value table for settings, the booked reminders and first-run flags.
  `CREATE TABLE points (
     id TEXT PRIMARY KEY NOT NULL,
     kind TEXT NOT NULL DEFAULT 'note',
     text TEXT NOT NULL,
     answer TEXT,
     category TEXT NOT NULL CHECK (category IN ('daily', 'long_term')),
     private INTEGER NOT NULL DEFAULT 0,
     archived INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     appearances INTEGER NOT NULL DEFAULT 0,
     last_appeared_at TEXT
   );
   CREATE INDEX points_live ON points (archived, category);
   CREATE TABLE kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`,
];

export function db(): Promise<SQLite.SQLiteDatabase> {
  if (!opened) {
    opened = (async () => {
      const d = await SQLite.openDatabaseAsync('yaadom.db');
      await d.execAsync('PRAGMA journal_mode = WAL;');
      const row = await d.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      let version = row?.user_version ?? 0;
      while (version < MIGRATIONS.length) {
        const sql = MIGRATIONS[version];
        const next = version + 1;
        await d.withExclusiveTransactionAsync(async (tx) => {
          await tx.execAsync(sql);
          // PRAGMA cannot take a bound value; `next` is a number from this file, never user input.
          await tx.execAsync(`PRAGMA user_version = ${next}`);
        });
        version = next;
      }
      return d;
    })().catch((e) => {
      opened = null;
      throw e;
    });
  }
  return opened;
}

interface PointRow {
  id: string;
  kind: string;
  text: string;
  answer: string | null;
  category: string;
  private: number;
  archived: number;
  created_at: string;
  updated_at: string;
  appearances: number;
  last_appeared_at: string | null;
}

const toPoint = (r: PointRow): Point => ({
  id: r.id,
  kind: r.kind === 'qa' ? 'qa' : 'note',
  text: r.text,
  answer: r.answer,
  category: r.category === 'long_term' ? 'long_term' : 'daily',
  private: r.private === 1,
  archived: r.archived === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  appearances: r.appearances,
  lastAppearedAt: r.last_appeared_at,
});

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export async function listPoints(): Promise<Point[]> {
  const d = await db();
  const rows = await d.getAllAsync<PointRow>('SELECT * FROM points ORDER BY created_at, id');
  return rows.map(toPoint);
}

/** Adds a point unless its category is full. The count and insert are one statement, so two quick taps cannot pass the limit. */
export async function addPoint(text: string, category: Category): Promise<boolean> {
  const d = await db();
  const now = new Date().toISOString();
  const r = await d.runAsync(
    `INSERT INTO points (id, kind, text, answer, category, private, archived, created_at, updated_at)
     SELECT ?, 'note', ?, NULL, ?, 0, 0, ?, ?
     WHERE (SELECT COUNT(*) FROM points WHERE category = ? AND archived = 0) < ?`,
    newId(), text, category, now, now, category, MAX_PER_CATEGORY,
  );
  return r.changes === 1;
}

export async function editPoint(id: string, text: string): Promise<void> {
  const d = await db();
  await d.runAsync('UPDATE points SET text = ?, updated_at = ? WHERE id = ?', text, new Date().toISOString(), id);
}

/** Moves a point to the other category unless that one is full. */
export async function movePoint(id: string, category: Category): Promise<boolean> {
  const d = await db();
  const r = await d.runAsync(
    `UPDATE points SET category = ?, updated_at = ?
     WHERE id = ? AND category <> ?
       AND (archived = 1 OR (SELECT COUNT(*) FROM points WHERE category = ? AND archived = 0) < ?)`,
    category, new Date().toISOString(), id, category, category, MAX_PER_CATEGORY,
  );
  return r.changes === 1;
}

export async function setPrivate(id: string, value: boolean): Promise<void> {
  const d = await db();
  await d.runAsync('UPDATE points SET private = ?, updated_at = ? WHERE id = ?', value ? 1 : 0, new Date().toISOString(), id);
}

export async function putAway(id: string): Promise<void> {
  const d = await db();
  await d.runAsync('UPDATE points SET archived = 1, updated_at = ? WHERE id = ?', new Date().toISOString(), id);
}

/** Brings a put-away point back unless its category is full. */
export async function bringBack(id: string): Promise<boolean> {
  const d = await db();
  const r = await d.runAsync(
    `UPDATE points SET archived = 0, updated_at = ?
     WHERE id = ? AND archived = 1
       AND (SELECT COUNT(*) FROM points p WHERE p.category = points.category AND p.archived = 0) < ?`,
    new Date().toISOString(), id, MAX_PER_CATEGORY,
  );
  return r.changes === 1;
}

/** Only a put-away point can be deleted for good. */
export async function deleteForGood(id: string): Promise<void> {
  const d = await db();
  await d.runAsync('DELETE FROM points WHERE id = ? AND archived = 1', id);
}

export async function getValue(key: string): Promise<string | null> {
  const d = await db();
  const row = await d.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setValue(key: string, value: string): Promise<void> {
  const d = await db();
  await d.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

/**
 * Adds the appearances of reminders that have passed, then stores the reminders still to come,
 * in one transaction so a count is never added twice.
 */
export async function recordAppearances(
  counts: Map<string, number>,
  lastAt: Map<string, string>,
  passed: number,
  latest: Booked | null,
  future: Booked[],
): Promise<void> {
  const d = await db();
  await d.withExclusiveTransactionAsync(async (tx) => {
    for (const [id, n] of counts) {
      await tx.runAsync(
        `UPDATE points SET appearances = appearances + ?,
           last_appeared_at = CASE WHEN last_appeared_at IS NULL OR last_appeared_at < ? THEN ? ELSE last_appeared_at END
         WHERE id = ?`,
        n, lastAt.get(id) ?? '', lastAt.get(id) ?? null, id,
      );
    }
    await tx.runAsync(
      'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      'booked', JSON.stringify(future),
    );
    if (latest) {
      // The most recent reminder that has passed: its points glow on Home and open as a moment.
      await tx.runAsync(
        'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        'lastShown', JSON.stringify(latest),
      );
    }
    if (passed > 0) {
      // Reminders whose time has passed, in total. Used only to open the sky early while testing.
      await tx.runAsync(
        `INSERT INTO kv (key, value) VALUES ('remindersPassed', ?)
         ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + ? AS TEXT)`,
        String(passed), passed,
      );
    }
  });
}
