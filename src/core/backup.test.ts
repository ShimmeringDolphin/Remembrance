import assert from 'node:assert/strict';
import test from 'node:test';

import { makeBackup, parseBackup, planRestore, type BackupPoint } from './backup.ts';
import type { Point } from './types';

const pt = (text: string, over: Partial<Point> = {}): Point => ({
  id: text, kind: 'note', text, answer: null, category: 'long_term', private: false, archived: false,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', appearances: 3, lastAppearedAt: null,
  expiresAt: null, pace: 'normal', voice: null, ...over,
});
const bp = (text: string, over: Partial<BackupPoint> = {}): BackupPoint => ({ text, category: 'long_term', private: false, archived: false, pace: 'normal', expiresAt: null, ...over });
const now = new Date('2026-06-01T10:00:00.000Z');

test('a backup reads back the same points, in any language', () => {
  const points = [pt('Be calm. शांत रहो।'), pt('Drink water', { category: 'daily', expiresAt: '2026-07-01T00:00:00.000Z', pace: 'often', private: true }), pt('old', { archived: true })];
  const r = parseBackup(makeBackup(points, now));
  assert.ok(r.ok);
  assert.equal(r.skipped, 0);
  assert.deepEqual(r.points.map((p) => p.text), ['Be calm. शांत रहो।', 'Drink water', 'old']);
  assert.deepEqual(r.points[1], bp('Drink water', { category: 'daily', expiresAt: '2026-07-01T00:00:00.000Z', pace: 'often', private: true }));
  assert.equal(r.points[2].archived, true);
});

test('a backup does not carry ids, counts, or recordings', () => {
  const text = makeBackup([pt('x', { voice: 'rec.m4a' })], now);
  assert.ok(!text.includes('rec.m4a'));
  assert.ok(!text.includes('appearances'));
  assert.ok(!/"id"/.test(text));
});

test('pasted text around the backup is ignored; anything else is refused', () => {
  const body = makeBackup([pt('a')], now);
  assert.ok(parseBackup(`Here is my backup:\n${body}\nThanks`).ok);
  for (const junk of ['', 'hello', '{', '{}', '[1,2]', '{"app":"other","version":1,"points":[]}', '{"app":"yaadom","version":2,"points":[]}', '{"app":"yaadom","version":1}', '{"app":"yaadom","version":1,"points":[1]}'.replace('[1]', 'null')]) {
    assert.equal(parseBackup(junk).ok, false, junk);
  }
});

test('unreadable points are skipped and counted, and fields are cleaned', () => {
  const raw = JSON.stringify({ app: 'yaadom', version: 1, points: [{ text: '  hi   there ', category: 'long_term', pace: 'fast', expiresAt: 'nope' }, { text: '', category: 'daily' }, { text: 'x', category: 'weekly' }, 5, { text: 'd', category: 'daily', expiresAt: '2026-08-01T00:00:00Z' }, { text: 'lt', category: 'long_term', expiresAt: '2026-08-01T00:00:00Z' }] });
  const r = parseBackup(raw);
  assert.ok(r.ok);
  assert.equal(r.skipped, 3);
  assert.deepEqual(r.points.map((p) => [p.text, p.pace, p.expiresAt]), [['hi there', 'normal', null], ['d', 'normal', '2026-08-01T00:00:00.000Z'], ['lt', 'normal', null]]);
});

test('restore skips duplicates, keeps what does not fit put away, and puts away expired Daily points', () => {
  const existing = [pt('keep'), ...Array.from({ length: 14 }, (_, i) => pt(`e${i}`))];
  const incoming = [bp('keep'), bp('keep'), bp('new1'), bp('new2'), bp('gone', { category: 'daily', expiresAt: '2026-05-01T00:00:00.000Z' }), bp('d1', { category: 'daily', expiresAt: '2026-07-01T00:00:00.000Z' })];
  const plan = planRestore(existing, incoming, now);
  assert.equal(plan.duplicates, 2);
  // 15 live long-term already: new1 and new2 are kept, but put away.
  assert.equal(plan.full, 2);
  assert.deepEqual(plan.add.map((p) => [p.text, p.archived]), [['new1', true], ['new2', true], ['gone', true], ['d1', false]]);
});

test('restore never goes past the limit with live points, and the same words twice in one backup add once', () => {
  const incoming = Array.from({ length: 20 }, (_, i) => bp(`p${i}`)).concat([bp('p0')]);
  const plan = planRestore([], incoming, now);
  assert.equal(plan.add.filter((p) => !p.archived).length, 15);
  assert.equal(plan.add.length, 20);
  assert.equal(plan.duplicates, 1);
  assert.equal(plan.full, 5);
});
