import assert from 'node:assert/strict';
import { test } from 'node:test';

import { homeRadius, starPoints, starRadius } from './star.ts';
import { starSize } from './sky.ts';

test('a star has ten points, the first straight up', () => {
  const pts = starPoints(10, 10, 10).split(' ');
  assert.equal(pts.length, 10);
  assert.equal(pts[0], '10,0');
});

test('inner points sit at 0.46 of the outer radius', () => {
  const [x, y] = starPoints(0, 0, 100).split(' ')[1].split(',').map(Number);
  assert.ok(Math.abs(Math.hypot(x, y) - 46) < 0.1);
});

test('Home radius runs from 7 to 14 px with use', () => {
  assert.equal(homeRadius(starSize(0)), 7);
  assert.equal(homeRadius(starSize(200)), 14);
  assert.ok(homeRadius(starSize(10)) > 7 && homeRadius(starSize(10)) < 14);
});

test('stars shrink to stay apart when there are many reminders', () => {
  assert.equal(starRadius(300, 12, 6), 6);
  assert.ok(starRadius(300, 46, 6) < 3 && starRadius(300, 46, 6) >= 2.5);
  assert.equal(starRadius(300, 200, 6), 2.5);
});
