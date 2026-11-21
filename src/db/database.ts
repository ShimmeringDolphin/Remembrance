import * as SQLite from 'expo-sqlite';

const DATABASE_VERSION = 3;
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

  if (version === 2) {
    // Last local day a daily point reminds ("YYYY-MM-DD"). Existing rows stay NULL (no end), so
    // points made before this change are never archived by surprise.
    await db.execAsync(`ALTER TABLE points ADD COLUMN repeat_until TEXT;`);
    version = 3;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
