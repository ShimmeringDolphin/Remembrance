import type { Settings } from '../core/types';
import { mergeSettings } from '../core/settingsDefaults';
import { detectLanguage } from '../i18n/strings';
import { getDb } from './database';

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ json: string }>('SELECT json FROM settings WHERE id = 1');
  let stored: unknown = null;
  if (row) {
    try {
      stored = JSON.parse(row.json);
    } catch {
      stored = null; // damaged record: fall back to defaults
    }
  }
  return mergeSettings(stored, detectLanguage());
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (id, json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json',
    JSON.stringify(settings),
  );
}
