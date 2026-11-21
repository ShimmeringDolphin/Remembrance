import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_DAILY_DAYS, expiryFor, isSameDay, lastDayOf, resolveDays } from './expiry.ts';

test('one day expires at the end of the day of entry', () => {
  const now = new Date(2026, 0, 10, 15, 30);
  assert.equal(expiryFor(now, 1).getTime(), new Date(2026, 0, 11, 0, 0).getTime());
});

test('six days expire at the end of the sixth day', () => {
  const now = new Date(2026, 0, 10, 8, 0);
  assert.equal(expiryFor(now, 6).getTime(), new Date(2026, 0, 16, 0, 0).getTime());
});

test('expiry works across a month end', () => {
  const now = new Date(2026, 0, 30, 8, 0);
  assert.equal(expiryFor(now, 3).getTime(), new Date(2026, 1, 2, 0, 0).getTime());
});

test('up to six days stays Daily', () => {
  assert.deepEqual(resolveDays(1), { longTerm: false, days: 1 });
  assert.deepEqual(resolveDays(MAX_DAILY_DAYS), { longTerm: false, days: 6 });
});

test('more than six days becomes Long-term', () => {
  assert.deepEqual(resolveDays(7), { longTerm: true, days: 7 });
});

test('bad input falls back to one day', () => {
  assert.deepEqual(resolveDays(0), { longTerm: false, days: 1 });
  assert.deepEqual(resolveDays(Number.NaN), { longTerm: false, days: 1 });
  assert.deepEqual(resolveDays(2.7), { longTerm: false, days: 2 });
});

test('lastDayOf gives the last day a point reminds, or null when it never expires', () => {
  const expires = expiryFor(new Date(2026, 0, 10, 15, 0), 3).toISOString();
  const last = lastDayOf(expires);
  assert.ok(last);
  assert.deepEqual([last.getFullYear(), last.getMonth(), last.getDate()], [2026, 0, 12]);
  assert.equal(lastDayOf(null), null);
});

test('isSameDay compares calendar days', () => {
  assert.ok(isSameDay(new Date(2026, 0, 5, 1), new Date(2026, 0, 5, 23)));
  assert.ok(!isSameDay(new Date(2026, 0, 5, 23), new Date(2026, 0, 6, 0)));
});
