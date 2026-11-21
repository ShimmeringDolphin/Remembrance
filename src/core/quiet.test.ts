import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_QUIET_RANGES, addQuietRange, removeQuietRange, shiftQuietRange } from './quiet.ts';
import { mergeSettings } from './settingsDefaults.ts';

test('adding a range starts at 13:00 to 14:00', () => {
  assert.deepEqual(addQuietRange([]), [{ start: '13:00', end: '14:00' }]);
});

test('no more than the maximum number of ranges', () => {
  let ranges = addQuietRange([]);
  for (let i = 0; i < 10; i++) ranges = addQuietRange(ranges);
  assert.equal(ranges.length, MAX_QUIET_RANGES);
  assert.equal(MAX_QUIET_RANGES, 3);
});

test('removing a range drops only that one', () => {
  const ranges = [{ start: '01:00', end: '02:00' }, { start: '03:00', end: '04:00' }];
  assert.deepEqual(removeQuietRange(ranges, 0), [{ start: '03:00', end: '04:00' }]);
  assert.deepEqual(removeQuietRange(ranges, 5), ranges);
});

test('shifting changes one end of one range and wraps around midnight', () => {
  const ranges = [{ start: '23:30', end: '06:00' }];
  assert.deepEqual(shiftQuietRange(ranges, 0, 'start', 30), [{ start: '00:00', end: '06:00' }]);
  assert.deepEqual(shiftQuietRange(ranges, 0, 'end', -30), [{ start: '23:30', end: '05:30' }]);
  assert.deepEqual(shiftQuietRange(ranges, 3, 'end', 30), ranges);
});

test('stored settings with too many quiet ranges are trimmed', () => {
  const many = Array.from({ length: 6 }, (_, i) => ({ start: `0${i}:00`, end: `0${i}:30` }));
  assert.equal(mergeSettings({ quietHours: many }, 'en').quietHours.length, MAX_QUIET_RANGES);
});
