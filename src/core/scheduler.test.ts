import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  intervalMinutes,
  MAX_PLANNED_NOTIFICATIONS,
  MIN_INTERVAL_MINUTES,
  parseTime,
  planReminders,
} from './scheduler.ts';
import type { Point, Settings } from './types.ts';

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

function point(id: string, overrides: Partial<Point> = {}): Point {
  return {
    id,
    kind: 'note',
    prompt: id,
    answer: null,
    detail: null,
    language: 'en',
    category: 'daily',
    tags: [],
    status: 'active',
    frequency: { mode: 'default' },
    nextDueAt: '2026-01-01T00:00:00.000Z',
    speak: false,
    private: false,
    notificationStyle: null,
    expiresAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastShownAt: null,
    timesShown: 0,
    timesRemembered: 0,
    ...overrides,
  };
}

// Local-time dates so the tests pass in any time zone.
const at = (day: number, h: number, m = 0) => new Date(2026, 0, day, h, m);
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

test('parseTime accepts HH:mm and rejects bad input', () => {
  assert.equal(parseTime('07:30'), 450);
  assert.equal(parseTime('7:05'), 425);
  assert.throws(() => parseTime('24:00'));
  assert.throws(() => parseTime('nope'));
});

test('hourly default runs 07:00 to 21:00 and stops before the 22:00 end', () => {
  const plan = planReminders([point('a')], settings, at(5, 0), 100);
  const day = plan.filter((r) => r.at.getDate() === 5).map((r) => hhmm(r.at));
  assert.equal(day.length, 15);
  assert.equal(day[0], '07:00');
  assert.equal(day.at(-1), '21:00');
});

test('only reminders after now are planned', () => {
  const plan = planReminders([point('a')], settings, at(5, 12, 30), 3);
  assert.deepEqual(plan.map((r) => hhmm(r.at)), ['13:00', '14:00', '15:00']);
});

test('after the last slot of the day, planning continues the next morning', () => {
  const plan = planReminders([point('a')], settings, at(5, 21, 30), 2);
  assert.equal(plan[0].at.getDate(), 6);
  assert.equal(hhmm(plan[0].at), '07:00');
});

test('asleep plans nothing', () => {
  assert.deepEqual(planReminders([point('a')], { ...settings, awake: false }, at(5, 0)), []);
});

test('archived and paused points are skipped', () => {
  const plan = planReminders([point('a', { status: 'archived' }), point('b', { status: 'paused' })], settings, at(5, 0));
  assert.deepEqual(plan, []);
});

test('quiet hours drop reminders instead of moving them', () => {
  const s = { ...settings, quietHours: [{ start: '12:00', end: '14:00' }] };
  const day = planReminders([point('a')], s, at(5, 0), 100)
    .filter((r) => r.at.getDate() === 5)
    .map((r) => hhmm(r.at));
  assert.ok(!day.includes('12:00') && !day.includes('13:00'));
  assert.ok(day.includes('11:00') && day.includes('14:00'));
});

test('active hours may cross midnight', () => {
  const s = { ...settings, activeHours: { start: '22:00', end: '02:00' } };
  const plan = planReminders([point('a')], s, at(5, 0), 4);
  assert.deepEqual(plan.map((r) => `${r.at.getDate()} ${hhmm(r.at)}`), ['5 22:00', '5 23:00', '6 00:00', '6 01:00']);
});

test('button-only mode ignores active hours but still respects quiet hours', () => {
  const s: Settings = { ...settings, activeMode: 'button_only', quietHours: [{ start: '23:00', end: '06:00' }] };
  const day = planReminders([point('a')], s, at(5, 0), 100)
    .filter((r) => r.at.getDate() === 5)
    .map((r) => hhmm(r.at));
  assert.equal(day[0], '06:00');
  assert.equal(day.at(-1), '22:00');
});

test('equal start and end of active hours means no reminders', () => {
  const s = { ...settings, activeHours: { start: '08:00', end: '08:00' } };
  assert.deepEqual(planReminders([point('a')], s, at(5, 0)), []);
});

test('grouped points sharing a time become one reminder', () => {
  const plan = planReminders([point('a'), point('b'), point('c')], settings, at(5, 6), 1);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].style, 'grouped');
  assert.deepEqual(plan[0].pointIds.sort(), ['a', 'b', 'c']);
});

test('points with different intervals group only where times coincide', () => {
  const half = point('half', { frequency: { mode: 'interval', everyMinutes: 30 } });
  const plan = planReminders([point('hour'), half], settings, at(5, 6), 3);
  assert.deepEqual(plan.map((r) => [hhmm(r.at), r.pointIds.length]), [['07:00', 2], ['07:30', 1], ['08:00', 2]]);
});

test('individual style sends one reminder per point', () => {
  const s: Settings = { ...settings, notificationStyle: 'individual' };
  const plan = planReminders([point('a'), point('b')], s, at(5, 0), 10);
  assert.ok(plan.every((r) => r.style === 'individual' && r.pointIds.length === 1));
});

test('a per-point style overrides the setting', () => {
  const plan = planReminders([point('a', { notificationStyle: 'individual' })], settings, at(5, 0), 2);
  assert.ok(plan.every((r) => r.style === 'individual'));
});

test('individual reminders stay inside active hours despite jitter and staggering', () => {
  const s: Settings = { ...settings, notificationStyle: 'individual' };
  const points = Array.from({ length: 20 }, (_, i) => point(`p${i}`));
  const plan = planReminders(points, s, at(5, 0), 500);
  for (const r of plan) {
    const m = r.at.getHours() * 60 + r.at.getMinutes();
    assert.ok(m >= 7 * 60 && m < 22 * 60, `outside active hours: ${hhmm(r.at)}`);
  }
});

test('planning is deterministic', () => {
  const s: Settings = { ...settings, notificationStyle: 'individual' };
  const points = [point('a'), point('b')];
  const one = planReminders(points, s, at(5, 0), 30).map((r) => r.at.getTime());
  const two = planReminders(points, s, at(5, 0), 30).map((r) => r.at.getTime());
  assert.deepEqual(one, two);
});

test('result is sorted and never exceeds the limit', () => {
  const s: Settings = { ...settings, notificationStyle: 'individual' };
  const points = Array.from({ length: 40 }, (_, i) => point(`p${i}`, { frequency: { mode: 'interval', everyMinutes: 15 } }));
  const plan = planReminders(points, s, at(5, 0));
  assert.equal(plan.length, MAX_PLANNED_NOTIFICATIONS);
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i - 1].at <= plan[i].at);
});

test('frequency is clamped to the minimum interval', () => {
  assert.equal(intervalMinutes({ mode: 'interval', everyMinutes: 1 }, settings, 900), MIN_INTERVAL_MINUTES);
  assert.equal(intervalMinutes({ mode: 'interval', everyMinutes: Number.NaN }, settings, 900), 60);
});

test('times per day spreads reminders over the active minutes', () => {
  assert.equal(intervalMinutes({ mode: 'per_day', timesPerDay: 5 }, settings, 900), 180);
  assert.equal(intervalMinutes({ mode: 'per_day', timesPerDay: 0 }, settings, 900), 60);
  assert.equal(intervalMinutes({ mode: 'per_day', timesPerDay: 500 }, settings, 900), MIN_INTERVAL_MINUTES);
});

test('default frequency comes from settings', () => {
  const s: Settings = { ...settings, defaultFrequency: { mode: 'interval', everyMinutes: 120 } };
  const plan = planReminders([point('a')], s, at(5, 6), 3);
  assert.deepEqual(plan.map((r) => hhmm(r.at)), ['07:00', '09:00', '11:00']);
});

test('no points plans nothing', () => {
  assert.deepEqual(planReminders([], settings, at(5, 0)), []);
});

test('a point does not remind at or after its expiry', () => {
  const expiresAt = at(2, 0).toISOString(); // midnight at the end of Jan 1
  const plan = planReminders([point('a', { expiresAt })], settings, at(1, 6, 0), 60);
  assert.ok(plan.length > 0);
  assert.ok(plan.every((r) => r.at.getTime() < at(2, 0).getTime()));
});

test('an already expired point plans nothing', () => {
  const expiresAt = at(1, 5).toISOString();
  assert.deepEqual(planReminders([point('a', { expiresAt })], settings, at(1, 6, 0)), []);
});

test('a point with no expiry keeps going across days', () => {
  const plan = planReminders([point('a')], settings, at(1, 6, 0), 60);
  assert.ok(plan.some((r) => r.at.getTime() >= at(2, 0).getTime()));
});
