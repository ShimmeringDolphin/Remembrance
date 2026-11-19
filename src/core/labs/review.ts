// Experimental: what happens when the user answers a point, and which planner each point uses.
// Pure. The UI and database call these; the rules live here so they can be tested.
import { planReminders, MAX_PLANNED_NOTIFICATIONS, type PlannedReminder } from '../scheduler.ts';
import type { Point, ReviewAnswer, ReviewLogEntry, Settings } from '../types';
import { planAdaptive } from './adaptivePlan.ts';
import { applyAnswer, newMemory, type PointMemory } from './memory.ts';

/** Long-term points start their adaptive gap at least this far apart (they are gentler than Daily). */
export const LONG_TERM_START_MINUTES = 240;

/** The opt-in: only Long-term points, only while the Labs switch is on. */
export const isAdaptive = (point: Point, settings: Settings): boolean =>
  settings.labs.adaptiveLongTerm && point.category === 'long_term';

export function startingMemory(point: Point, settings: Settings, now: Date): PointMemory {
  const every = settings.defaultFrequency.mode === 'interval' ? settings.defaultFrequency.everyMinutes : 60;
  return newMemory(point.id, now, Math.max(every, LONG_TERM_START_MINUTES));
}

export interface AnswerOutcome {
  log: ReviewLogEntry;
  /** Present only for adaptive points; save it. Otherwise null and nothing about the schedule changes. */
  memory: PointMemory | null;
}

export function recordAnswer(
  point: Point,
  memory: PointMemory | undefined,
  answer: ReviewAnswer,
  settings: Settings,
  now: Date,
): AnswerOutcome {
  const log: ReviewLogEntry = { pointId: point.id, shownAt: now.toISOString(), answer };
  if (!isAdaptive(point, settings)) return { log, memory: null };
  const current = memory ?? startingMemory(point, settings, now);
  return { log, memory: applyAnswer(current, answer, point.category, now) };
}

/**
 * One plan for every active point: the existing fixed-grid planner for ordinary points and the
 * adaptive planner for opted-in ones, merged soonest first and capped for the iOS limit.
 * Adaptive points with no memory yet are planned from a fresh starting memory.
 */
export function planAll(
  points: readonly Point[],
  memories: ReadonlyMap<string, PointMemory>,
  settings: Settings,
  now: Date,
  limit: number = MAX_PLANNED_NOTIFICATIONS,
): PlannedReminder[] {
  const adaptive = points.filter((p) => isAdaptive(p, settings));
  const fixed = points.filter((p) => !isAdaptive(p, settings));
  const filled = new Map(memories);
  for (const p of adaptive) if (!filled.has(p.id)) filled.set(p.id, startingMemory(p, settings, now));
  return [...planReminders(fixed, settings, now, limit), ...planAdaptive(adaptive, filled, settings, now, limit)]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, limit);
}

/** An adaptive reminder this long past its due time with no answer counts as dismissed. */
export const DISMISS_GRACE_MINUTES = 5;

export interface Reconciled {
  memories: PointMemory[];
  log: ReviewLogEntry[];
}

/**
 * Called on app open while reminders are on. A booked reminder that came and went with no answer
 * is recorded as `dismissed`: the gap is kept and the next reminder moves one gap ahead. Without
 * this, opening the app after a missed reminder would book another one within minutes.
 * Also gives opted-in points that have no memory yet their starting memory.
 */
export function reconcile(
  points: readonly Point[],
  memories: ReadonlyMap<string, PointMemory>,
  settings: Settings,
  now: Date,
): Reconciled {
  const out: Reconciled = { memories: [], log: [] };
  for (const p of points) {
    if (p.status !== 'active' || !isAdaptive(p, settings)) continue;
    const mem = memories.get(p.id);
    if (!mem) {
      out.memories.push(startingMemory(p, settings, now));
    } else if (Date.parse(mem.nextDueAt) + DISMISS_GRACE_MINUTES * 60000 < now.getTime()) {
      out.memories.push(applyAnswer(mem, 'dismissed', p.category, now));
      out.log.push({ pointId: p.id, shownAt: mem.nextDueAt, answer: 'dismissed' });
    }
  }
  return out;
}
