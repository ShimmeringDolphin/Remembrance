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

test('labs switch defaults off and only accepts a boolean', () => {
  assert.equal(defaultSettings('en').labs.adaptiveLongTerm, false);
  assert.equal(mergeSettings({ labs: { adaptiveLongTerm: true } }, 'en').labs.adaptiveLongTerm, true);
  assert.equal(mergeSettings({ labs: { adaptiveLongTerm: 'yes' } }, 'en').labs.adaptiveLongTerm, false);
  assert.equal(mergeSettings({ labs: 5 }, 'en').labs.adaptiveLongTerm, false);
});

test('app lock and voice settings are kept when valid and ignored when not', () => {
  const s = mergeSettings({ appLock: { enabled: true, timeoutSeconds: 300 }, delivery: { voice: true } }, 'en');
  assert.deepEqual(s.appLock, { enabled: true, timeoutSeconds: 300 });
  assert.equal(s.delivery.voice, true);
  const junk = mergeSettings({ appLock: { enabled: 'x', timeoutSeconds: -1 }, delivery: { voice: 3 } }, 'en');
  assert.deepEqual(junk.appLock, defaultSettings('en').appLock);
  assert.equal(junk.delivery.voice, false);
});

test('shiftTime wraps around midnight', () => {
  assert.equal(shiftTime('23:30', 60), '00:30');
  assert.equal(shiftTime('00:15', -30), '23:45');
  assert.equal(shiftTime('07:00', 30), '07:30');
});

const text = { title: 'YaadOM', groupedBody: 'Time to review: {n} points', privateBody: 'You have a point to remember' };
const point = { id: 'a', prompt: 'Kepler', private: false } as Point;
const map = new Map([['a', point], ['p', { ...point, id: 'p', prompt: 'secret', private: true } as Point]]);
const at = new Date(2026, 0, 5, 9);

test('grouped content shows only a count', () => {
  const c = buildContent({ at, style: 'grouped', pointIds: ['a', 'p'] }, map, text, false);
  assert.equal(c.body, 'Time to review: 2 points');
  assert.ok(!c.body.includes('secret'));
});

test('individual content shows the point text', () => {
  assert.equal(buildContent({ at, style: 'individual', pointIds: ['a'] }, map, text, false).body, 'Kepler');
});

test('private mode, private points and missing points never show text', () => {
  assert.equal(buildContent({ at, style: 'individual', pointIds: ['a'] }, map, text, true).body, text.privateBody);
  assert.equal(buildContent({ at, style: 'individual', pointIds: ['p'] }, map, text, false).body, text.privateBody);
  assert.equal(buildContent({ at, style: 'individual', pointIds: ['gone'] }, map, text, false).body, text.privateBody);
});
