import assert from 'node:assert/strict';
import { test } from 'node:test';

import { daysFromToday, expiryFor } from './expiry.ts';

test('days from today counts today as 1', () => {
  const today = new Date(2026, 10, 28, 15, 0);
  assert.equal(daysFromToday(expiryFor(today, 1).toISOString(), today), 1);
  assert.equal(daysFromToday(expiryFor(today, 4).toISOString(), today), 4);
  assert.equal(daysFromToday(expiryFor(new Date(2026, 10, 26), 5).toISOString(), today), 3);
});

test('a point that never stops has no days', () => {
  assert.equal(daysFromToday(null, new Date()), null);
});
