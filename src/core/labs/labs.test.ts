import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planAdaptive, snapToActiveSlot, SLOT_MINUTES } from './adaptivePlan.ts';
import { adviseOnPoints, hourlyEngagement, rhythm, suggestQuietHours } from './insights.ts';
import { effectivePrivate, initialLockState, isLocked, onAuthenticated, onBackground, onForeground } from './lock.ts';
import { applyAnswer, EASE_MAX, EASE_MIN, MAX_INTERVAL, newMemory, retrievability, AGAIN_SOON_MINUTES } from './memory.ts';
import { buildSession, summariseSession } from './queue.ts';
import { buildVoiceScript } from './voice.ts';
import type { Point, ReviewLogEntry, Settings } from '../types';

const settings: Settings = {
  defaultFrequency: { mode: 'interval', everyMinutes: 60 },
  activeHours: { start: '07:00', end: '22:00' },
  activeMode: 'hours',
  awake: true,
  quietHours: [],
  appLanguage: 'en',
  speechRate: 1,
  delivery: { notification: true, widget: false, voice: false },
  appLock: { enabled: false, timeoutSeconds: 60 },
  notificationStyle: 'grouped',
  privateNotifications: false,
};

function point(id: string, o: Partial<Point> = {}): Point {
  return {
    id, kind: 'note', prompt: `text ${id}`, answer: null, detail: null, language: 'en', category: 'daily',
    tags: [], status: 'active', frequency: { mode: 'default' }, nextDueAt: '2026-01-01T00:00:00.000Z',
    speak: false, private: false, notificationStyle: null, createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', lastShownAt: null, timesShown: 0, timesRemembered: 0, ...o,
  };
}
const at = (day: number, h: number, m = 0) => new Date(2026, 0, day, h, m);
const mins = (a: string, b: Date) => (Date.parse(a) - b.getTime()) / 60000;

test('remembering stretches the gap, again_soon shrinks it and retries soon', () => {
  const now = at(5, 9);
  let m = newMemory('a', now, 60);
  m = applyAnswer(m, 'remembered', 'long_term', now);
  assert.ok(m.intervalMinutes > 60);
  assert.equal(m.streak, 1);
  const before = m.intervalMinutes;
  const lapsed = applyAnswer(m, 'again_soon', 'long_term', now);
  assert.ok(lapsed.intervalMinutes < before);
  assert.equal(lapsed.lapses, 1);
  assert.equal(lapsed.streak, 0);
  assert.equal(mins(lapsed.nextDueAt, now), AGAIN_SOON_MINUTES);
});

test('dismissed leaves the gap alone and only counts as ignored', () => {
  const now = at(5, 9);
  const m = newMemory('a', now, 120);
  const d = applyAnswer(m, 'dismissed', 'daily', now);
  assert.equal(d.intervalMinutes, 120);
  assert.equal(d.ignored, 1);
  assert.equal(applyAnswer(d, 'remembered', 'daily', now).ignored, 0);
});

test('gap and ease stay inside their limits', () => {
  const now = at(5, 9);
  let m = newMemory('a', now, 60);
  for (let i = 0; i < 60; i++) m = applyAnswer(m, 'remembered', 'daily', now);
  assert.equal(m.intervalMinutes, MAX_INTERVAL.daily);
  assert.equal(m.ease, EASE_MAX);
  for (let i = 0; i < 60; i++) m = applyAnswer(m, 'again_soon', 'daily', now);
  assert.equal(m.intervalMinutes, 15);
  assert.equal(m.ease, EASE_MIN);
});

test('retrievability is 90% one gap after review and falls over time', () => {
  const now = at(5, 9);
  const m = applyAnswer(newMemory('a', now, 60), 'remembered', 'long_term', now);
  assert.ok(Math.abs(retrievability(m, now) - 1) < 1e-9);
  const later = new Date(now.getTime() + m.intervalMinutes * 60000);
  assert.ok(Math.abs(retrievability(m, later) - 0.9) < 1e-9);
  const muchLater = new Date(now.getTime() + 10 * m.intervalMinutes * 60000);
  assert.ok(retrievability(m, muchLater) < 0.6);
  assert.equal(retrievability(newMemory('b', now), now), 0.6);
});

test('snapToActiveSlot rounds up to the slot grid and skips the night', () => {
  const s = snapToActiveSlot(at(5, 9, 1), settings)!;
  assert.equal(s.getMinutes() % SLOT_MINUTES, 0);
  assert.equal(`${s.getHours()}:${s.getMinutes()}`, '9:15');
  const night = snapToActiveSlot(at(5, 23, 0), settings)!;
  assert.equal(night.getDate(), 6);
  assert.equal(night.getHours(), 7);
});

test('planAdaptive books a short chain per point, groups shared slots and stays asleep when asleep', () => {
  const now = at(5, 8);
  const points = [point('a'), point('b')];
  const mem = new Map([
    ['a', { ...newMemory('a', now, 60), nextDueAt: at(5, 9, 5).toISOString() }],
    ['b', { ...newMemory('b', now, 60), nextDueAt: at(5, 9, 10).toISOString() }],
  ]);
  const plan = planAdaptive(points, mem, settings, now);
  assert.equal(plan.length, 3); // first slot merges a and b; then two follow-ups
  assert.deepEqual(plan[0].pointIds.sort(), ['a', 'b']);
  assert.deepEqual(planAdaptive(points, mem, { ...settings, awake: false }, now), []);
  assert.ok(planAdaptive(points, mem, settings, now, 2).length <= 2);
});

test('planAdaptive ignores points without memory and overdue points fire soon', () => {
  const now = at(5, 12);
  const mem = new Map([['a', { ...newMemory('a', at(4, 9), 60), nextDueAt: at(4, 10).toISOString() }]]);
  const plan = planAdaptive([point('a'), point('nomem')], mem, settings, now);
  assert.ok(plan[0].at.getTime() > now.getTime());
  assert.ok(plan.every((r) => !r.pointIds.includes('nomem')));
});

test('buildSession puts the weakest memory first and caps the size', () => {
  const now = at(5, 12);
  const fresh = applyAnswer(newMemory('fresh', at(5, 11), 60), 'remembered', 'daily', at(5, 11, 55));
  const stale = { ...applyAnswer(newMemory('stale', at(5, 1), 60), 'remembered', 'daily', at(5, 1)) };
  const mem = new Map([['fresh', fresh], ['stale', stale]]);
  const s = buildSession([point('fresh'), point('stale'), point('arch', { status: 'archived' })], mem, now, { size: 5 });
  assert.deepEqual(s.map((p) => p.id), ['stale', 'fresh']);
  assert.equal(buildSession([point('a'), point('b')], new Map(), now, { size: 1 }).length, 1);
  assert.deepEqual(buildSession([point('a'), point('b')], new Map(), now, { onlyIds: ['b'] }).map((p) => p.id), ['b']);
});

test('summariseSession gives a tone, never text', () => {
  assert.equal(summariseSession([]).tone, 'none');
  assert.equal(summariseSession(['remembered']).tone, 'all_remembered');
  assert.deepEqual(summariseSession(['remembered', 'again_soon']), { total: 2, remembered: 1, again: 1, tone: 'mixed' });
});

const entry = (d: Date, answer: ReviewLogEntry['answer'] = 'remembered'): ReviewLogEntry => ({ pointId: 'a', shownAt: d.toISOString(), answer });

test('rhythm: a missed day spends a rest token instead of breaking the run', () => {
  const log = [entry(at(1, 9)), entry(at(2, 9)), entry(at(4, 9))]; // day 3 missed
  const r = rhythm(log, at(4, 20));
  assert.equal(r.run, 3);
  assert.equal(r.restTokens, 0);
  assert.deepEqual(r.week.slice(-4), [true, true, false, true]);
});

test('rhythm: running out of tokens resets the run; today never breaks it; dismissed is not practice', () => {
  const log = [entry(at(1, 9)), entry(at(2, 9)), entry(at(6, 9))]; // days 3,4,5 missed
  assert.equal(rhythm(log, at(6, 20)).run, 1);
  assert.equal(rhythm([entry(at(1, 9)), entry(at(2, 9))], at(3, 6)).run, 2); // today not done yet
  assert.equal(rhythm([entry(at(1, 9), 'dismissed')], at(1, 20)).run, 0);
  assert.equal(rhythm([], at(1, 9)).run, 0);
});

test('quiet-hour suggestions need enough evidence and merge adjacent hours', () => {
  const log: ReviewLogEntry[] = [];
  for (const h of [13, 14]) for (let i = 0; i < 10; i++) log.push(entry(at(1 + i, h), 'dismissed'));
  for (let i = 0; i < 10; i++) log.push(entry(at(1 + i, 9)));
  for (let i = 0; i < 3; i++) log.push(entry(at(1 + i, 20), 'dismissed')); // too few to judge
  assert.deepEqual(suggestQuietHours(hourlyEngagement(log)), [{ start: '13:00', end: '15:00' }]);
});

test('advice is a suggestion list and never edits points', () => {
  const now = at(5, 9);
  const base = newMemory('x', now);
  const pts = [point('r'), point('g'), point('i'), point('lt', { category: 'long_term' })];
  const mem = new Map([
    ['r', { ...base, pointId: 'r', lapses: 5, streak: 0 }],
    ['g', { ...base, pointId: 'g', streak: 9 }],
    ['i', { ...base, pointId: 'i', ignored: 3 }],
    ['lt', { ...base, pointId: 'lt', streak: 20 }],
  ]);
  assert.deepEqual(adviseOnPoints(pts, mem), [
    { pointId: 'r', kind: 'reword' },
    { pointId: 'g', kind: 'graduate' },
    { pointId: 'i', kind: 'gentler' },
  ]);
  assert.equal(pts[1].category, 'daily');
});

test('voice script respects private mode, caps length and pauses for question points', () => {
  const pts = [point('a'), point('p', { private: true }), point('q', { kind: 'qa', prompt: 'Q?', answer: 'A', language: 'hi' })];
  const v = buildVoiceScript(pts, false);
  assert.equal(v.skippedPrivate, 1);
  const says = v.steps.filter((s) => s.kind === 'say');
  assert.deepEqual(says.map((s) => s.kind === 'say' && s.text), ['text a', 'Q?', 'A']);
  assert.ok(says.some((s) => s.kind === 'say' && s.locale === 'hi-IN'));
  assert.equal(buildVoiceScript(pts, true).steps.length, 0);
  const many = Array.from({ length: 20 }, (_, i) => point(`m${i}`));
  assert.equal(buildVoiceScript(many, false).steps.filter((s) => s.kind === 'say').length, 5);
});

test('app lock: locks after the timeout, not before, and implies private notifications', () => {
  const lock = { enabled: true, timeoutSeconds: 60 };
  let s = initialLockState();
  assert.equal(isLocked(s, lock), true);
  s = onAuthenticated();
  assert.equal(isLocked(onForeground(onBackground(s, 1000), 50_000, lock), lock), false);
  assert.equal(isLocked(onForeground(onBackground(s, 1000), 62_000, lock), lock), true);
  assert.equal(isLocked(initialLockState(), { ...lock, enabled: false }), false);
  assert.equal(effectivePrivate({ ...settings, appLock: lock }), true);
  assert.equal(effectivePrivate({ ...settings, appLock: lock }, true), false);
  assert.equal(effectivePrivate(settings), false);
});
