import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addDays,
  clampRepeatDays,
  daysLeft,
  isDateKey,
  isExpired,
  localDateKey,
  MAX_DAILY_REPEAT_DAYS,
  repeatUntilFor,
} from './dailyRepeat.ts';

const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

test('local date keys are zero-padded and sort as text', () => {
  assert.equal(localDateKey(day(2026, 1, 5)), '2026-01-05');
  assert.ok(localDateKey(day(2026, 1, 9)) < localDateKey(day(2026, 1, 10)));
  assert.ok(isDateKey('2026-11-21'));
  assert.ok(!isDateKey('2026-1-5'));
});

test('one day means the last day is the day of entry', () => {
  assert.equal(repeatUntilFor(day(2026, 11, 21), 1), '2026-11-21');
});

test('six days counts the day of entry and crosses month and year ends', () => {
  assert.equal(repeatUntilFor(day(2026, 11, 21), 6), '2026-11-26');
  assert.equal(repeatUntilFor(day(2026, 12, 29, 23), 6), '2027-01-03');
});

test('repeat days are clamped to 1..6', () => {
  assert.equal(clampRepeatDays(0), 1);
  assert.equal(clampRepeatDays(-3), 1);
  assert.equal(clampRepeatDays(NaN), 1);
  assert.equal(clampRepeatDays(9), MAX_DAILY_REPEAT_DAYS);
  assert.equal(repeatUntilFor(day(2026, 11, 21), 40), '2026-11-26');
});

test('days left counts today and reaches 0 after the last day', () => {
  assert.equal(daysLeft('2026-11-26', day(2026, 11, 21, 1)), 6);
  assert.equal(daysLeft('2026-11-21', day(2026, 11, 21, 23)), 1);
  assert.equal(daysLeft('2026-11-20', day(2026, 11, 21)), 0);
  assert.equal(daysLeft('junk', day(2026, 11, 21)), 0);
});

test('a point expires the day after its last day; no last day never expires', () => {
  assert.equal(isExpired({ repeatUntil: '2026-11-21' }, day(2026, 11, 21, 23)), false);
  assert.equal(isExpired({ repeatUntil: '2026-11-21' }, day(2026, 11, 22, 0)), true);
  assert.equal(isExpired({ repeatUntil: null }, day(2030, 1, 1)), false);
});

test('addDays moves by calendar days', () => {
  assert.equal(localDateKey(addDays(day(2026, 3, 31), 1)), '2026-04-01');
  assert.equal(localDateKey(addDays(day(2026, 3, 1), -1)), '2026-02-28');
});
