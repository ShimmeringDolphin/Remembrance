import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planAdaptive, snapToActiveSlot, SLOT_MINUTES } from './adaptivePlan.ts';
import { adviseOnPoints, hourlyEngagement, rhythm, suggestQuietHours } from './insights.ts';
import { effectivePrivate, initialLockState, isLocked, onAuthenticated, onBackground, onForeground } from './lock.ts';
import { applyAnswer, EASE_MAX, EASE_MIN, MAX_INTERVAL, newMemory, retrievability, AGAIN_SOON_MINUTES } from './memory.ts';
import { buildSession, summariseSession } from './queue.ts';
import { buildVoiceScript } from './voice.ts';
import { isAdaptive, planAll, reconcile, recordAnswer, LONG_TERM_START_MINUTES } from './review.ts';
import { planAnchors } from './anchors.ts';
import { gapParts } from './format.ts';
import { layoutSky, MAX_STARS } from './sky.ts';
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
  labs: { adaptiveLongTerm: false },
  anchors: { enabled: false, times: ['08:00', '12:30', '18:00', '21:00'] },
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

test('sky layout is deterministic, in bounds, evenly spaced and stable when points are added', () => {
  const pts = Array.from({ length: 30 }, (_, i) => point(`p${String(i).padStart(2, '0')}`, { createdAt: `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z` }));
  const a = layoutSky(pts);
  assert.deepEqual(layoutSky(pts), a);
  for (const s of a) assert.ok(s.x >= 0 && s.x <= 1 && s.y >= 0 && s.y <= 1);
  let nearest = Infinity;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) nearest = Math.min(nearest, Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y));
  assert.ok(nearest > 0.04, `stars too close: ${nearest}`);
  const more = layoutSky([...pts, point('zzz', { createdAt: '2026-02-01T00:00:00.000Z' })]);
  assert.deepEqual(more.slice(0, 30), a);
  assert.equal(layoutSky(Array.from({ length: 200 }, (_, i) => point(`x${i}`))).length, MAX_STARS);
});

const labsOn: Settings = { ...settings, labs: { adaptiveLongTerm: true } };

test('adaptivity is opt-in and only for Long-term points', () => {
  const lt = point('l', { category: 'long_term' });
  assert.equal(isAdaptive(lt, settings), false);
  assert.equal(isAdaptive(lt, labsOn), true);
  assert.equal(isAdaptive(point('d'), labsOn), false);
});

test('recordAnswer always logs, but only changes memory for adaptive points', () => {
  const now = at(5, 9);
  const daily = recordAnswer(point('d'), undefined, 'remembered', labsOn, now);
  assert.equal(daily.memory, null);
  assert.equal(daily.log.answer, 'remembered');
  const off = recordAnswer(point('l', { category: 'long_term' }), undefined, 'remembered', settings, now);
  assert.equal(off.memory, null);
  const on = recordAnswer(point('l', { category: 'long_term' }), undefined, 'remembered', labsOn, now);
  assert.ok(on.memory && on.memory.intervalMinutes > LONG_TERM_START_MINUTES);
  assert.equal(on.memory.streak, 1);
});

test('planAll sends ordinary points to the grid planner and opted-in ones to the adaptive planner', () => {
  const now = at(5, 8);
  const pts = [point('d'), point('l', { category: 'long_term' })];
  const off = planAll(pts, new Map(), settings, now);
  assert.ok(off.some((r) => r.pointIds.length === 2)); // grid planner groups both points
  const on = planAll(pts, new Map(), labsOn, now);
  const longTermTimes = on.filter((r) => r.pointIds.includes('l'));
  assert.ok(longTermTimes.length <= 3 && longTermTimes.length >= 1);
  const dailyTimes = on.filter((r) => r.pointIds.includes('d'));
  assert.ok(dailyTimes.length > 3);
  assert.ok(on.every((r, i) => i === 0 || on[i - 1].at.getTime() <= r.at.getTime()));
  assert.ok(planAll(pts, new Map(), labsOn, now, 4).length <= 4);
  assert.deepEqual(planAll(pts, new Map(), { ...labsOn, awake: false }, now), []);
});

test('reconcile records a missed adaptive reminder as dismissed and seeds missing memory', () => {
  const now = at(5, 12);
  const lt = point('l', { category: 'long_term' });
  const missed = { ...newMemory('l', at(5, 6), 120), nextDueAt: at(5, 8).toISOString() };
  const r = reconcile([lt], new Map([['l', missed]]), labsOn, now);
  assert.equal(r.memories[0].ignored, 1);
  assert.equal(r.memories[0].intervalMinutes, 120);
  assert.ok(Date.parse(r.memories[0].nextDueAt) > now.getTime());
  assert.deepEqual(r.log, [{ pointId: 'l', shownAt: missed.nextDueAt, answer: 'dismissed' }]);
  // not yet due, still inside the grace period, not adaptive: nothing happens
  const future = { ...missed, nextDueAt: at(5, 14).toISOString() };
  assert.deepEqual(reconcile([lt], new Map([['l', future]]), labsOn, now).memories, []);
  const justNow = { ...missed, nextDueAt: at(5, 11, 58).toISOString() };
  assert.deepEqual(reconcile([lt], new Map([['l', justNow]]), labsOn, now).memories, []);
  assert.deepEqual(reconcile([lt], new Map([['l', missed]]), settings, now).memories, []);
  const seeded = reconcile([lt], new Map(), labsOn, now);
  assert.equal(seeded.memories[0].pointId, 'l');
  assert.deepEqual(seeded.log, []);
});

test('gapParts picks a readable unit', () => {
  assert.deepEqual(gapParts(10), { unit: 'minute', n: 10 });
  assert.deepEqual(gapParts(0.2), { unit: 'minute', n: 1 });
  assert.deepEqual(gapParts(180), { unit: 'hour', n: 3 });
  assert.deepEqual(gapParts(2880), { unit: 'day', n: 2 });
  assert.deepEqual(gapParts(43200), { unit: 'day', n: 30 });
});

test('anchors book one grouped reminder per chosen moment, inside active hours only', () => {
  const on: Settings = { ...settings, anchors: { enabled: true, times: ['06:00', '08:00', '12:30', '22:30'] } };
  const plan = planAnchors([point('a'), point('b'), point('gone', { status: 'archived' })], on, at(5, 7));
  const first = plan.slice(0, 3).map((r) => `${r.at.getDate()} ${r.at.getHours()}:${r.at.getMinutes()}`);
  assert.deepEqual(first, ['5 8:0', '5 12:30', '6 8:0']); // 06:00 and 22:30 are outside 07:00-22:00
  assert.ok(plan.every((r) => r.style === 'grouped' && r.pointIds.join() === 'a,b'));
  assert.deepEqual(planAnchors([point('a')], { ...on, awake: false }, at(5, 7)), []);
  assert.deepEqual(planAnchors([], on, at(5, 7)), []);
  assert.ok(planAnchors([point('a')], on, at(5, 7), 3).length === 3);
});

test('planAll uses anchors for ordinary points when enabled and still plans adaptive points separately', () => {
  const on: Settings = { ...labsOn, anchors: { enabled: true, times: ['08:00', '12:30'] } };
  const plan = planAll([point('d'), point('l', { category: 'long_term' })], new Map(), on, at(5, 7));
  const daily = plan.filter((r) => r.pointIds.includes('d'));
  assert.deepEqual(daily.slice(0, 2).map((r) => r.at.getHours()), [8, 12]);
  assert.ok(plan.some((r) => r.pointIds.includes('l') && !r.pointIds.includes('d')));
});
