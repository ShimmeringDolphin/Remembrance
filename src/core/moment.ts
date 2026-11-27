// A moment: the points of one reminder, shown one at a time. Pure helpers.
import { parseBooked, type Booked } from './appearances.ts';
import { starSize } from './sky.ts';
import type { Point } from './types';

/** Points from the latest reminder glow on Home for this long. */
export const FRESH_MINUTES = 90;

/** Ids of points from the latest reminder, if it came within FRESH_MINUTES. */
export function freshIds(latest: Booked | null, now: Date, minutes: number = FRESH_MINUTES): Set<string> {
  if (!latest) return new Set();
  const t = Date.parse(latest.at);
  if (!Number.isFinite(t) || t > now.getTime() || now.getTime() - t > minutes * 60000) return new Set();
  return new Set(latest.pointIds);
}

/** The points of a moment, in reminder order; missing and put-away points are left out. */
export function momentPoints(ids: readonly string[], points: readonly Point[]): Point[] {
  const byId = new Map(points.map((p) => [p.id, p]));
  const out: Point[] = [];
  for (const id of new Set(ids)) {
    const p = byId.get(id);
    if (p && !p.archived) out.push(p);
  }
  return out;
}

/** How much each star in a moment grew: from its size before this appearance to now. */
export function starGrowth(p: Point): { from: number; to: number } {
  return { from: starSize(Math.max(0, p.appearances - 1)), to: starSize(p.appearances) };
}

/** Reads aloud every live, non-private point, oldest first. Private points are never spoken. */
export function listenQueue(points: readonly Point[]): Point[] {
  return points
    .filter((p) => !p.archived && !p.private)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** The stored latest reminder; damaged data reads as none. */
export function parseShown(json: string | null | undefined): Booked | null {
  if (!json) return null;
  return parseBooked(`[${json}]`)[0] ?? null;
}

/** Point ids carried in a tapped notification's data, if any. */
export function idsFromData(data: unknown): string[] {
  if (typeof data !== 'object' || data === null) return [];
  const ids = (data as { pointIds?: unknown }).pointIds;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
}

/** One step of Listen: a run of points for the phone's voice, or one point in the user's own voice. */
export type ListenStep = { kind: 'phone'; points: Point[] } | { kind: 'own'; point: Point };

/**
 * Groups the Listen queue so the phone's voice gets each run of points at once (waiting for each
 * one to finish stopped after the first point on some phones) and recordings play one by one.
 */
export function listenSteps(queue: readonly Point[]): ListenStep[] {
  const out: ListenStep[] = [];
  for (const p of queue) {
    if (p.voice) out.push({ kind: 'own', point: p });
    else {
      const last = out[out.length - 1];
      if (last?.kind === 'phone') last.points.push(p);
      else out.push({ kind: 'phone', points: [p] });
    }
  }
  return out;
}

/** The ids of shown notifications whose due time (`at`) is the reminder just seen in the app. */
export function shownFor(shown: readonly { id: string; data: unknown }[], at: string): string[] {
  return shown
    .filter((n) => typeof n.data === 'object' && n.data !== null && (n.data as { at?: unknown }).at === at)
    .map((n) => n.id);
}

/**
 * Notifications in the shade that carry points, none of which is live any more (deleted or put away).
 * Prompts and other notes carry no points and are left alone.
 */
export function emptyShown(shown: readonly { id: string; data: unknown }[], points: readonly Point[]): string[] {
  return shown.filter((n) => {
    const ids = idsFromData(n.data);
    return ids.length > 0 && momentPoints(ids, points).length === 0;
  }).map((n) => n.id);
}

/**
 * Reminder notifications other than the newest, by due time. Wake-up prompts and the "open the app" note
 * carry no due time and are left alone. Keeps the shade to one reminder at a time.
 */
export function olderShown(shown: readonly { id: string; data: unknown }[]): string[] {
  const due = (d: unknown): number => {
    const at = typeof d === 'object' && d !== null ? (d as { at?: unknown }).at : undefined;
    return typeof at === 'string' ? Date.parse(at) : NaN;
  };
  const reminders = shown.filter((n) => Number.isFinite(due(n.data)));
  if (reminders.length <= 1) return [];
  const newest = reminders.reduce((a, b) => (due(b.data) > due(a.data) ? b : a));
  return reminders.filter((n) => n !== newest).map((n) => n.id);
}
