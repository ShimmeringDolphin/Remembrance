import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildContent } from './reminderContent.ts';
import { defaultSettings, mergeSettings } from './settingsDefaults.ts';
import { shiftTime } from './time.ts';
import type { Point } from './types.ts';

test('defaults match the spec: hourly, 07:00 to 22:00, grouped, awake', () => {
  const s = defaultSettings('en');
  assert.deepEqual(s.defaultFrequency, { mode: 'interval', everyMinutes: 60 });
  assert.deepEqual(s.activeHours, { start: '07:00', end: '22:00' });
  assert.equal(s.notificationStyle, 'grouped');
  assert.equal(s.awake, true);
});

test('mergeSettings keeps valid stored values', () => {
  const s = mergeSettings({ activeHours: { start: '06:30', end: '23:00' }, awake: false, notificationStyle: 'individual' }, 'en');
  assert.deepEqual(s.activeHours, { start: '06:30', end: '23:00' });
  assert.equal(s.awake, false);
  assert.equal(s.notificationStyle, 'individual');
});

test('mergeSettings falls back to defaults for junk', () => {
  for (const junk of [null, undefined, 5, 'x', [], { activeHours: { start: '99:99', end: 'no' }, defaultFrequency: { mode: 'interval', everyMinutes: -5 }, awake: 'yes' }]) {
    assert.deepEqual(mergeSettings(junk, 'hi'), defaultSettings('hi'));
  }
});

test('shiftTime wraps around midnight', () => {
  assert.equal(shiftTime('23:30', 60), '00:30');
  assert.equal(shiftTime('00:15', -30), '23:45');
  assert.equal(shiftTime('07:00', 30), '07:30');
});

const text = { title: 'YaadOM', more: '+{n} more', privateBody: 'A point to keep in mind', privateGroupedBody: '{n} points to keep in mind' };
const point = { id: 'a', prompt: 'Kepler', private: false } as Point;
const others = ['b', 'c', 'd', 'e'].map((id) => ({ ...point, id, prompt: `text ${id}` }) as Point);
const map = new Map<string, Point>([['a', point], ['p', { ...point, id: 'p', prompt: 'secret', private: true } as Point], ...others.map((o) => [o.id, o] as [string, Point])]);
const at = new Date(2026, 0, 5, 9);
const hourLater = new Date(2026, 0, 5, 10, 1);

test('grouped content shows the points themselves, never the private ones', () => {
  const c = buildContent({ at, style: 'grouped', pointIds: ['a', 'p'] }, map, text, false);
  assert.ok(c.body.includes('Kepler'));
  assert.ok(!c.body.includes('secret'));
  assert.ok(c.body.includes('+1 more'));
});

test('grouped content rotates which point leads, hour by hour', () => {
  const ids = ['a', 'b', 'c'];
  const first = buildContent({ at, style: 'grouped', pointIds: ids }, map, text, false).body.split('\n')[0];
  const next = buildContent({ at: hourLater, style: 'grouped', pointIds: ids }, map, text, false).body.split('\n')[0];
  assert.notEqual(first, next);
  const leads = new Set([0, 1, 2].map((h) => buildContent({ at: new Date(2026, 0, 5, 9 + h), style: 'grouped', pointIds: ids }, map, text, false).body.split('\n')[0]));
  assert.equal(leads.size, 3, 'each point should lead once in three hours');
});

test('grouped content shows at most four points and counts the rest', () => {
  const c = buildContent({ at, style: 'grouped', pointIds: ['a', 'b', 'c', 'd', 'e'] }, map, text, false);
  const lines = c.body.split('\n');
  assert.equal(lines.length, 5);
  assert.equal(lines.at(-1), '+1 more');
});

test('grouped content in private mode, or with only private points, shows only a count', () => {
  assert.equal(buildContent({ at, style: 'grouped', pointIds: ['a', 'p'] }, map, text, true).body, '2 points to keep in mind');
  assert.equal(buildContent({ at, style: 'grouped', pointIds: ['p'] }, map, text, false).body, text.privateBody);
});

test('individual content shows the point text', () => {
  assert.equal(buildContent({ at, style: 'individual', pointIds: ['a'] }, map, text, false).body, 'Kepler');
});

test('private mode, private points and missing points never show text', () => {
  assert.equal(buildContent({ at, style: 'individual', pointIds: ['a'] }, map, text, true).body, text.privateBody);
  assert.equal(buildContent({ at, style: 'individual', pointIds: ['p'] }, map, text, false).body, text.privateBody);
  assert.equal(buildContent({ at, style: 'individual', pointIds: ['gone'] }, map, text, false).body, text.privateBody);
});
