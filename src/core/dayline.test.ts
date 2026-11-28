import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dayLine } from './dayline.ts';
import { defaultSettings } from './settings.ts';

const settings = { ...defaultSettings('en'), mode: 'hours' as const, from: '09:00', to: '21:00', every: 60, asleep: false, quiet: [] };

test('today runs from the first to the last reminder, past ones marked', () => {
  const now = new Date(2026, 10, 28, 12, 30);
  const line = dayLine(settings, now)!;
  assert.ok(line.stars.length >= 11);
  assert.equal(line.stars[0].frac, 0);
  assert.equal(line.stars[line.stars.length - 1].frac, 1);
  assert.ok(line.stars[0].past);
  assert.ok(!line.stars[line.stars.length - 1].past);
  assert.ok(line.now > 0.2 && line.now < 0.6);
  assert.ok(line.stars.every((s) => s.at.getDate() === 28));
});

test('nothing while Asleep', () => {
  assert.equal(dayLine({ ...settings, asleep: true }, new Date(2026, 10, 28, 12, 0)), null);
});

test('quiet hours leave a wider gap and no star inside it', () => {
  const quiet = [{ start: '13:00', end: '15:00' }];
  const line = dayLine({ ...settings, quiet }, new Date(2026, 10, 28, 10, 0))!;
  assert.ok(line.stars.every((s) => s.at.getHours() < 13 || s.at.getHours() >= 15));
});
