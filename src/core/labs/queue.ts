// Experimental: which points go into one Review now session, and in what order.
// A session is a small handful (default 7) with a visible finish line, weakest memory first.
import type { Point } from '../types';
import { retrievability, type PointMemory } from './memory.ts';

export const SESSION_SIZE = 7;

export interface SessionOptions {
  size?: number;
  /** Only these ids (a tapped reminder); otherwise every active point is a candidate. */
  onlyIds?: readonly string[];
}

/** Weakest first (lowest chance of recall). Ties keep the older point first. */
export function buildSession(
  points: readonly Point[],
  memories: ReadonlyMap<string, PointMemory>,
  now: Date,
  options: SessionOptions = {},
): Point[] {
  const size = options.size ?? SESSION_SIZE;
  const only = options.onlyIds ? new Set(options.onlyIds) : null;
  const scored = points
    .filter((p) => p.status === 'active' && (!only || only.has(p.id)))
    .map((p) => {
      const mem = memories.get(p.id);
      return { p, r: mem ? retrievability(mem, now) : 0.6 };
    });
  scored.sort((a, b) => a.r - b.r || a.p.createdAt.localeCompare(b.p.createdAt) || a.p.id.localeCompare(b.p.id));
  return scored.slice(0, Math.max(0, size)).map((s) => s.p);
}

export interface SessionSummary {
  total: number;
  remembered: number;
  again: number;
  /** `all_remembered`, `mixed` or `none`: the UI maps these to translated text. No text lives here. */
  tone: 'all_remembered' | 'mixed' | 'none';
}

export function summariseSession(answers: readonly ('remembered' | 'again_soon')[]): SessionSummary {
  const remembered = answers.filter((a) => a === 'remembered').length;
  const again = answers.length - remembered;
  return {
    total: answers.length,
    remembered,
    again,
    tone: answers.length === 0 ? 'none' : again === 0 ? 'all_remembered' : 'mixed',
  };
}
