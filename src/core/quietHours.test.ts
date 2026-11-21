import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addQuietRange, MAX_QUIET_HOURS, NEW_QUIET_RANGE, removeQuietRange, updateQuietRange } from './quietHours.ts';
import { mergeSettings } from './settingsDefaults.ts';

const lunch = { start: '13:00', end: '14:00' };
const night = { start: '23:00', end: '06:00' };

test('adding a range appends the default one and stops at the maximum', () => {
  let list = addQuietRange([]);
  assert.deepEqual(list, [NEW_QUIET_RANGE]);
  for (let i = 0; i < 5; i++) list = addQuietRange(list);
  assert.equal(list.length, MAX_QUIET_HOURS);
});

test('the default range is a copy, so editing one never changes the next', () => {
  const list = addQuietRange([]);
  list[0].start = '09:00';
  assert.equal(addQuietRange([])[0].start, '13:00');
});

test('remove and update touch only the chosen range and leave the input alone', () => {
  const list = [lunch, night];
  assert.deepEqual(removeQuietRange(list, 0), [night]);
  assert.deepEqual(updateQuietRange(list, 1, { start: '22:00', end: '06:00' }), [lunch, { start: '22:00', end: '06:00' }]);
  assert.deepEqual(list, [lunch, night]);
});

test('stored settings keep at most the maximum number of valid quiet ranges', () => {
  const stored = { quietHours: [lunch, { start: 'bad', end: '1' }, night, lunch, night] };
  const s = mergeSettings(stored, 'en');
  assert.equal(s.quietHours.length, MAX_QUIET_HOURS);
  assert.deepEqual(s.quietHours, [lunch, night, lunch]);
});
