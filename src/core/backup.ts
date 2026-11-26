// Backing up and restoring points as plain text the user keeps themselves (a note, an email to themselves, a file).
// Pure: no I/O. The backup holds the points' words, so it is only ever made when the user asks, and never logged.
import { MAX_PER_CATEGORY, cleanText } from './limits.ts';
import { isPace } from './pace.ts';
import type { Category, Pace, Point } from './types';

export const BACKUP_APP = 'yaadom';
export const BACKUP_VERSION = 1;
/** More than this in one backup is not a backup of this app. */
const MAX_BACKUP_POINTS = 500;

export interface BackupPoint {
  text: string;
  category: Category;
  private: boolean;
  archived: boolean;
  pace: Pace;
  /** Daily points only: when they stop (ISO 8601), or null. */
  expiresAt: string | null;
}

/** The backup text: JSON with a version, so a later app can still read an older backup. Voice recordings are not included. */
export function makeBackup(points: readonly Point[], now: Date): string {
  const list: BackupPoint[] = points.map((p) => ({
    text: p.text,
    category: p.category,
    private: p.private,
    archived: p.archived,
    pace: p.pace,
    expiresAt: p.category === 'daily' ? p.expiresAt : null,
  }));
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), points: list }, null, 2);
}

export type ParsedBackup = { ok: true; points: BackupPoint[]; skipped: number } | { ok: false };

const validStamp = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

/**
 * Reads what the user pasted. Text around the backup (an email greeting, say) is ignored; anything that is not a
 * backup of this app is refused. Each point is cleaned like a typed one; unreadable ones are counted as skipped.
 */
export function parseBackup(raw: string): ParsedBackup {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return { ok: false };
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { ok: false };
  }
  if (typeof data !== 'object' || data === null) return { ok: false };
  const d = data as { app?: unknown; version?: unknown; points?: unknown };
  if (d.app !== BACKUP_APP || typeof d.version !== 'number' || d.version < 1 || d.version > BACKUP_VERSION) return { ok: false };
  if (!Array.isArray(d.points) || d.points.length > MAX_BACKUP_POINTS) return { ok: false };
  const points: BackupPoint[] = [];
  let skipped = 0;
  for (const item of d.points) {
    const p = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const text = typeof p.text === 'string' ? cleanText(p.text) : null;
    const category: Category | null = p.category === 'daily' || p.category === 'long_term' ? p.category : null;
    if (!text || !category) {
      skipped++;
      continue;
    }
    points.push({
      text,
      category,
      private: p.private === true,
      archived: p.archived === true,
      pace: isPace(p.pace) ? p.pace : 'normal',
      expiresAt: category === 'daily' && validStamp(p.expiresAt) ? new Date(p.expiresAt).toISOString() : null,
    });
  }
  return { ok: true, points, skipped };
}

export interface RestorePlan {
  /** Points to add, in order; the ones with `archived` go in already put away. */
  add: BackupPoint[];
  /** Already here (same words in the same category). */
  duplicates: number;
  /** Not added because their category is full; they are kept put away instead. */
  full: number;
}

/**
 * What to add. Points already here (same words, same category) are skipped, also within the backup itself.
 * A live point that would pass the limit of its category goes in put away instead, so nothing is lost.
 * A Daily point whose last day has passed also goes in put away.
 */
export function planRestore(existing: readonly Point[], incoming: readonly BackupPoint[], now: Date): RestorePlan {
  const key = (category: Category, text: string) => `${category}\u0000${text}`;
  const have = new Set(existing.map((p) => key(p.category, p.text)));
  const live: Record<Category, number> = { daily: 0, long_term: 0 };
  for (const p of existing) if (!p.archived) live[p.category]++;
  const add: BackupPoint[] = [];
  let duplicates = 0;
  let full = 0;
  for (const p of incoming) {
    const k = key(p.category, p.text);
    if (have.has(k)) {
      duplicates++;
      continue;
    }
    have.add(k);
    const over = p.expiresAt !== null && Date.parse(p.expiresAt) <= now.getTime();
    let archived = p.archived || over;
    if (!archived) {
      if (live[p.category] >= MAX_PER_CATEGORY) {
        archived = true;
        full++;
      } else live[p.category]++;
    }
    add.push({ ...p, archived });
  }
  return { add, duplicates, full };
}
