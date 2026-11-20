import { type BookedReminder, parseBooked } from '../core/exposure';
import { getDb } from './database';

export async function getBooked(): Promise<BookedReminder[]> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ json: string }>('SELECT json FROM booked_reminders WHERE id = 1');
  return parseBooked(row?.json);
}

export async function saveBooked(list: readonly BookedReminder[]): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO booked_reminders (id, json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json',
    JSON.stringify(list),
  );
}
