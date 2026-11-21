import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_DAILY_DAYS, expiryFor, resolveDays } from './expiry.ts';

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
