import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pointIdsFromData } from './reminderData.ts';

test('reads string ids', () => {
  assert.deepEqual(pointIdsFromData({ style: 'grouped', pointIds: ['a', 'b'] }), ['a', 'b']);
});
test('ignores bad data', () => {
  assert.deepEqual(pointIdsFromData(null), []);
  assert.deepEqual(pointIdsFromData('x'), []);
  assert.deepEqual(pointIdsFromData({ pointIds: 'a' }), []);
  assert.deepEqual(pointIdsFromData({ pointIds: ['a', 1, null, 'b'] }), ['a', 'b']);
});
test('caps the number of ids', () => {
  const many = Array.from({ length: 80 }, (_, i) => String(i));
  assert.equal(pointIdsFromData({ pointIds: many }).length, 50);
});
