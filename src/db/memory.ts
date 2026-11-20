// Experimental (open-creativity): storage for adaptive spacing state. All SQL uses bound parameters.
import type { PointMemory } from '../core/labs/memory';
import { getDb } from './database';

interface Row {
  point_id: string;
  interval_minutes: number;
  ease: number;
  streak: number;
  lapses: number;
  ignored: number;
  last_reviewed_at: string | null;
  next_due_at: string;
}

const toMemory = (r: Row): PointMemory => ({
  pointId: r.point_id,
  intervalMinutes: r.interval_minutes,
  ease: r.ease,
  streak: r.streak,
  lapses: r.lapses,
  ignored: r.ignored,
  lastReviewedAt: r.last_reviewed_at,
  nextDueAt: r.next_due_at,
});

export async function listMemories(): Promise<Map<string, PointMemory>> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT * FROM point_memory');
  return new Map(rows.map((r) => [r.point_id, toMemory(r)]));
}

export async function saveMemory(m: PointMemory): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO point_memory (point_id, interval_minutes, ease, streak, lapses, ignored, last_reviewed_at, next_due_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (point_id) DO UPDATE SET interval_minutes = excluded.interval_minutes, ease = excluded.ease,
       streak = excluded.streak, lapses = excluded.lapses, ignored = excluded.ignored,
       last_reviewed_at = excluded.last_reviewed_at, next_due_at = excluded.next_due_at`,
    [m.pointId, m.intervalMinutes, m.ease, m.streak, m.lapses, m.ignored, m.lastReviewedAt, m.nextDueAt],
  );
}
