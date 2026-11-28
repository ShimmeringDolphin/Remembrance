import assert from 'node:assert/strict';
import { test } from 'node:test';

import { homeRadius, starPoints, starRadius, threadSpans, tooCrowded } from './star.ts';
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

test('a crowded strip becomes a thread; a roomy one keeps its stars', () => {
  const every = (min: number) => Array.from({ length: Math.floor(690 / min) + 1 }, (_, k) => (570 + k * min) / 1440); // 09:30 to 21:00
  assert.equal(tooCrowded(304, every(15)), true);
  assert.equal(tooCrowded(304, every(30)), true);
  assert.equal(tooCrowded(304, every(60)), false);
  assert.equal(tooCrowded(304, every(120)), false);
  assert.equal(tooCrowded(304, [0.5]), false);
  assert.equal(tooCrowded(0, every(15)), false);
});

test('thread spans break at quiet hours', () => {
  const day = [0.1, 0.11, 0.12, 0.13, 0.5, 0.51, 0.52];
  const spans = threadSpans(day);
  assert.equal(spans.length, 2);
  assert.equal(spans[0].from, 0.1);
  assert.equal(spans[0].to, 0.13);
  assert.equal(spans[1].from, 0.5);
  assert.deepEqual(threadSpans([]), []);
  assert.equal(threadSpans([0.3]).length, 1);
});
