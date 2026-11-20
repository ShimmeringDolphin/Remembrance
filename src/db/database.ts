import * as SQLite from 'expo-sqlite';

const DATABASE_VERSION = 4;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Opens the database once and runs migrations. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('yaadom.db');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      CREATE TABLE points (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL DEFAULT 'note',
        prompt TEXT NOT NULL,
        answer TEXT,
        detail TEXT,
        language TEXT NOT NULL DEFAULT 'en',
        category TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        frequency TEXT NOT NULL DEFAULT '{"mode":"default"}',
        next_due_at TEXT NOT NULL,
        speak INTEGER NOT NULL DEFAULT 0,
        private INTEGER NOT NULL DEFAULT 0,
        notification_style TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_shown_at TEXT,
        times_shown INTEGER NOT NULL DEFAULT 0,
        times_remembered INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_points_category_status ON points (category, status);
    `);
    version = 1;
  }

  if (version === 1) {
    await db.execAsync(`
      CREATE TABLE settings (
        id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
        json TEXT NOT NULL
      );
    `);
    version = 2;
  }

  // Experimental (open-creativity): adaptive spacing state, one row per point.
  if (version === 2) {
    await db.execAsync(`
      CREATE TABLE point_memory (
        point_id TEXT PRIMARY KEY NOT NULL REFERENCES points (id) ON DELETE CASCADE,
        interval_minutes INTEGER NOT NULL,
        ease REAL NOT NULL,
        streak INTEGER NOT NULL DEFAULT 0,
        lapses INTEGER NOT NULL DEFAULT 0,
        ignored INTEGER NOT NULL DEFAULT 0,
        last_reviewed_at TEXT,
        next_due_at TEXT NOT NULL
      );
    `);
    version = 3;
  }

  // Every answer to a reminder or Review now card. Holds ids and times only, never point text.
  if (version === 3) {
    await db.execAsync(`
      CREATE TABLE review_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        point_id TEXT NOT NULL,
        shown_at TEXT NOT NULL,
        answer TEXT NOT NULL
      );
      CREATE INDEX idx_review_log_shown_at ON review_log (shown_at);
    `);
    version = 4;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
