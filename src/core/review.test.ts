import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_REVIEW_IDS, pickReviewPoints, pointIdsFromNotificationData } from './review.ts';
import type { Point } from './types.ts';

function point(id: string, status: Point['status'] = 'active'): Point {
  return {
    id,
    kind: 'note',
    prompt: `text ${id}`,
    answer: null,
    detail: null,
    language: 'en',
    category: 'daily',
    tags: [],
    status,
    frequency: { mode: 'default' },
    nextDueAt: '2026-01-01T00:00:00.000Z',
    speak: false,
    notificationStyle: null,
    private: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastShownAt: null,
    timesShown: 0,
    timesRemembered: 0,
  };
}

test('reads point ids from reminder data', () => {
  assert.deepEqual(pointIdsFromNotificationData({ style: 'grouped', pointIds: ['a', 'b'] }), ['a', 'b']);
});

test('rejects data that is not one of our reminders', () => {
  for (const bad of [null, undefined, 'x', 42, {}, { pointIds: 'a' }, { pointIds: [] }, { pointIds: [1, null, ''] }]) {
    assert.equal(pointIdsFromNotificationData(bad), null);
  }
});

test('drops bad and duplicate ids and caps the count', () => {
  assert.deepEqual(pointIdsFromNotificationData({ pointIds: ['a', 7, 'a', 'x'.repeat(65), 'b'] }), ['a', 'b']);
  const many = Array.from({ length: MAX_REVIEW_IDS + 5 }, (_, i) => `p${i}`);
  assert.equal(pointIdsFromNotificationData({ pointIds: many })?.length, MAX_REVIEW_IDS);
});

test('review keeps the reminder order and skips archived or missing points', () => {
  const points = [point('a'), point('b', 'archived'), point('c'), point('d', 'paused')];
  assert.deepEqual(
    pickReviewPoints(points, ['c', 'b', 'gone', 'a', 'd']).map((p) => p.id),
    ['c', 'a'],
  );
});

test('opened from the app, review shows every active point', () => {
  const points = [point('a'), point('b', 'archived'), point('c')];
  assert.deepEqual(pickReviewPoints(points, null).map((p) => p.id), ['a', 'c']);
});
