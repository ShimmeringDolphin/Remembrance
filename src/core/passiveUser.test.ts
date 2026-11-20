import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getStrings } from '../i18n/strings.ts';
import { countAppearances, parseBooked } from './exposure.ts';
import { canAddPoint, MAX_POINTS_PER_CATEGORY } from './limits.ts';
import { FULL_STAR_APPEARANCES, layoutSky, skyUnlocked, SKY_UNLOCK_APPEARANCES, starSize, totalAppearances } from './sky.ts';
import type { Point } from './types.ts';

function point(id: string, o: Partial<Point> = {}): Point {
  return {
    id, kind: 'note', prompt: id, answer: null, detail: null, language: 'en', category: 'daily', tags: [], status: 'active',
    frequency: { mode: 'default' }, nextDueAt: '2026-01-01T00:00:00.000Z', speak: false, private: false, notificationStyle: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastShownAt: null, timesShown: 0, timesRemembered: 0, ...o,
  };
}

test('the 15-point limit allows the 15th point and stops the 16th', () => {
  assert.equal(MAX_POINTS_PER_CATEGORY, 15);
  assert.equal(canAddPoint(14), true);
  assert.equal(canAddPoint(15), false);
});

test('appearances count only reminders whose time has passed, once per point per reminder', () => {
  const now = new Date('2026-01-05T12:00:00.000Z');
  const booked = [
    { at: '2026-01-05T10:00:00.000Z', pointIds: ['a', 'b'] },
    { at: '2026-01-05T11:00:00.000Z', pointIds: ['a', 'a'] },
    { at: '2026-01-05T13:00:00.000Z', pointIds: ['a'] },
  ];
  const r = countAppearances(booked, now);
  assert.equal(r.counts.get('a'), 2);
  assert.equal(r.counts.get('b'), 1);
  assert.equal(r.lastAt.get('a'), '2026-01-05T11:00:00.000Z');
  assert.equal(countAppearances([], now).counts.size, 0);
});

test('a damaged booking record counts as empty', () => {
  assert.deepEqual(parseBooked(null), []);
  assert.deepEqual(parseBooked('not json'), []);
  assert.deepEqual(parseBooked('{"at":1}'), []);
  assert.deepEqual(parseBooked('[{"at":"x","pointIds":[1]}, {"at":"2026-01-01T00:00:00Z","pointIds":["a"]}]'), [{ at: '2026-01-01T00:00:00Z', pointIds: ['a'] }]);
});

test('stars grow with appearances, never shrink, and cap at full size', () => {
  assert.ok(Math.abs(starSize(0) - 0.15) < 1e-9);
  let prev = 0;
  for (const n of [0, 1, 5, 20, 100, FULL_STAR_APPEARANCES]) {
    assert.ok(starSize(n) > prev);
    prev = starSize(n);
  }
  assert.equal(starSize(FULL_STAR_APPEARANCES), 1);
  assert.equal(starSize(10_000), 1);
});

test('the sky skips archived points, keeps stars in place as points are added, and unlocks after a while', () => {
  const pts = Array.from({ length: 10 }, (_, i) => point(`p${i}`, { createdAt: `2026-01-01T00:00:0${i}.000Z`, timesShown: 3 }));
  const sky = layoutSky([...pts, point('old', { status: 'archived', timesShown: 999 })]);
  assert.equal(sky.length, 10);
  for (const s of sky) assert.ok(s.x > 0 && s.x < 1 && s.y > 0 && s.y < 1);
  assert.deepEqual(layoutSky([...pts, point('new', { createdAt: '2026-02-01T00:00:00.000Z' })]).slice(0, 10), sky);
  assert.equal(totalAppearances(pts), 30);
  assert.equal(skyUnlocked(pts), 30 >= SKY_UNLOCK_APPEARANCES);
  assert.equal(skyUnlocked([point('a', { timesShown: 1 })]), false);
});

test('every string exists in all languages with the same placeholders', () => {
  const ph = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  const en = getStrings('en');
  for (const lang of ['hi', 'gu'] as const) {
    const other = getStrings(lang);
    assert.deepEqual(Object.keys(other).sort(), Object.keys(en).sort());
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      assert.ok(other[k].trim().length > 0, `${lang}.${k} empty`);
      assert.equal(ph(other[k]), ph(en[k]), `${lang}.${k} placeholders`);
    }
  }
});

test('no task language in English text', () => {
  const en = getStrings('en');
  for (const [k, v] of Object.entries(en)) assert.ok(!/\b(review|due|overdue|task)\b/i.test(v), `${k}: "${v}"`);
});
