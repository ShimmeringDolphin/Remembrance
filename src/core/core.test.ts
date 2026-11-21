/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countAppearances, parseBooked } from './appearances.ts';
import { buildContent } from './content.ts';
import { canAdd, cleanText, MAX_PER_CATEGORY, MAX_TEXT_LENGTH } from './limits.ts';
import { DAYS_AHEAD, fillTimes, HANDFUL, JITTER_MINUTES, LONG_TERM_EVERY, MAX_BOOKED, planSlots, planTimes } from './planner.ts';
import { defaultSettings, mergeSettings } from './settings.ts';
import { FULL_STAR, layoutSky, starSize, totalAppearances } from './sky.ts';
import { formatTime, parseTime, shiftTime, windowLength } from './time.ts';
import type { Point, Settings } from './types.ts';

const settings: Settings = defaultSettings('en');
const at = (day: number, h: number, m = 0) => new Date(2026, 0, day, h, m);
const mins = (d: Date) => d.getHours() * 60 + d.getMinutes();
let seq = 0;
function point(id: string, o: Partial<Point> = {}): Point {
  seq++;
  return {
    id, kind: 'note', text: `text ${id}`, answer: null, category: 'daily', private: false, archived: false,
    createdAt: `2026-01-01T00:${String(Math.floor(seq / 60) % 60).padStart(2, '0')}:${String(seq % 60).padStart(2, '0')}.000Z`,
    updatedAt: '2026-01-01T00:00:00.000Z', appearances: 0, lastAppearedAt: null, ...o,
  };
}

// ---- time and settings

test('times parse, format, shift across midnight and measure windows', () => {
  assert.equal(parseTime('07:30'), 450);
  assert.throws(() => parseTime('24:00'));
  assert.equal(formatTime(-30), '23:30');
  assert.equal(shiftTime('23:45', 30), '00:15');
  assert.equal(windowLength('07:00', '22:00'), 900);
  assert.equal(windowLength('22:00', '02:00'), 240);
  assert.equal(windowLength('08:00', '08:00'), 0);
});

test('defaults are hourly 07:00 to 22:00, not paused, not private', () => {
  assert.deepEqual(defaultSettings('hi'), { from: '07:00', to: '22:00', pace: 'regular', paused: false, privateMode: false, language: 'hi' });
});

test('stored settings keep valid values and fall back on junk', () => {
  assert.equal(mergeSettings({ from: '06:30', pace: 'often', privateMode: true }, 'en').from, '06:30');
  for (const junk of [null, 3, 'x', [], { from: '99:00', pace: 'fast', paused: 'yes', language: 'fr' }]) {
    assert.deepEqual(mergeSettings(junk, 'gu'), defaultSettings('gu'));
  }
});

// ---- times

test('regular pace: 15 reminders a day from about 07:00 to about 21:00, never outside the window', () => {
  const times = planTimes(settings, at(5, 0), 200).filter((d) => d.getDate() === 5);
  assert.equal(times.length, 15);
  for (const d of times) assert.ok(mins(d) >= 7 * 60 && mins(d) < 22 * 60);
  assert.ok(mins(times[0]) <= 7 * 60 + JITTER_MINUTES);
  assert.ok(mins(times.at(-1)!) >= 21 * 60 - JITTER_MINUTES);
});

test('times are nudged a little, deterministically, and stay in order', () => {
  const a = planTimes(settings, at(5, 0), 60);
  assert.deepEqual(a.map(Number), planTimes(settings, at(5, 0), 60).map(Number));
  assert.ok(a.some((d) => d.getMinutes() !== 0));
  for (const d of a) assert.ok(Math.min(d.getMinutes(), 60 - d.getMinutes()) <= JITTER_MINUTES);
  for (let i = 1; i < a.length; i++) assert.ok(a[i] > a[i - 1]);
});

test('paces give 30, 60 and 120 minutes between reminders, roughly', () => {
  for (const [pace, gap] of [['often', 30], ['regular', 60], ['gentle', 120]] as const) {
    const t = planTimes({ ...settings, pace }, at(5, 6), 4);
    const g = (t[2].getTime() - t[1].getTime()) / 60000;
    assert.ok(Math.abs(g - gap) <= 2 * JITTER_MINUTES, `${pace}: ${g}`);
  }
});

test('only times after now; after the window closes, the next morning', () => {
  assert.ok(planTimes(settings, at(5, 12, 30), 10).every((d) => d > at(5, 12, 30)));
  const next = planTimes(settings, at(5, 21, 30), 1)[0];
  assert.equal(next.getDate(), 6);
  assert.ok(mins(next) <= 7 * 60 + JITTER_MINUTES);
});

test('a window crossing midnight still runs after midnight', () => {
  const s: Settings = { ...settings, from: '22:00', to: '02:00' };
  const t = planTimes(s, at(5, 0, 30), 2);
  assert.equal(t[0].getDate(), 5);
  assert.ok(mins(t[0]) >= 60 - JITTER_MINUTES && mins(t[0]) < 120);
  for (const d of planTimes(s, at(5, 12), 40)) assert.ok(mins(d) >= 22 * 60 || mins(d) < 2 * 60, `outside: ${d}`);
});

test('paused or an empty window books nothing; the iOS cap and the horizon hold', () => {
  assert.deepEqual(planTimes({ ...settings, paused: true }, at(5, 0)), []);
  assert.deepEqual(planTimes({ ...settings, from: '08:00', to: '08:00' }, at(5, 0)), []);
  assert.equal(planTimes({ ...settings, pace: 'often' }, at(5, 0)).length, MAX_BOOKED);
  const far = planTimes({ ...settings, pace: 'gentle', from: '12:00', to: '13:00' }, at(5, 0), 1000);
  assert.ok(far.length <= DAYS_AHEAD);
});

// ---- which points each reminder shows

test('each reminder shows a handful, and every daily point gets its fair turn', () => {
  const pts = Array.from({ length: 7 }, (_, i) => point(`d${i}`));
  const slots = fillTimes(planTimes(settings, at(5, 0), 60), pts, settings);
  const seen = new Map<string, number>();
  for (const s of slots) {
    assert.ok(s.pointIds.length <= HANDFUL);
    assert.equal(new Set(s.pointIds).size, s.pointIds.length, 'a point twice in one reminder');
    for (const id of s.pointIds) seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  const counts = [...seen.values()];
  assert.equal(seen.size, 7);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 2, `unfair: ${counts}`);
});

test('long-term points join every third reminder and take turns; alone they fill the handful', () => {
  const pts = [point('d1'), point('d2'), point('d3'), point('l1', { category: 'long_term' }), point('l2', { category: 'long_term' })];
  const slots = fillTimes(planTimes(settings, at(5, 0), 30), pts, settings);
  const withLt = slots.filter((s) => s.pointIds.some((id) => id.startsWith('l')));
  assert.ok(Math.abs(withLt.length - slots.length / LONG_TERM_EVERY) <= 1);
  assert.deepEqual(new Set(withLt.flatMap((s) => s.pointIds.filter((id) => id.startsWith('l')))), new Set(['l1', 'l2']));
  const onlyLt = fillTimes(planTimes(settings, at(5, 0), 5), [point('a', { category: 'long_term' }), point('b', { category: 'long_term' })], settings);
  assert.ok(onlyLt.every((s) => s.pointIds.length === 2));
});

test('put-away points never appear; no live points means nothing is booked', () => {
  const pts = [point('a'), point('gone', { archived: true })];
  assert.ok(planSlots(pts, settings, at(5, 0)).every((s) => !s.pointIds.includes('gone')));
  assert.deepEqual(planSlots([point('x', { archived: true })], settings, at(5, 0)), []);
  assert.deepEqual(planSlots([], settings, at(5, 0)), []);
});

test('the turn order carries on across rebookings instead of restarting', () => {
  const pts = Array.from({ length: 6 }, (_, i) => point(`r${i}`));
  const first = planSlots(pts, settings, at(5, 6), 2);
  const later = planSlots(pts, settings, at(5, 7, 30), 1);
  assert.notDeepEqual(first[0].pointIds, later[0].pointIds);
});

// ---- notification text

const text = { title: 'YaadOM', privateOne: 'A point to keep in mind', privateMany: '{n} points to keep in mind', privateExtra: '+{n} private' };

test('a reminder shows the points themselves, one per line', () => {
  const byId = new Map([['a', point('a')], ['b', point('b')]]);
  assert.equal(buildContent(['a', 'b'], byId, false, text).body, 'text a\ntext b');
});

test('private points and private mode never show words', () => {
  const byId = new Map([['a', point('a')], ['p', point('p', { private: true, text: 'secret' })]]);
  const mixed = buildContent(['a', 'p'], byId, false, text).body;
  assert.ok(!mixed.includes('secret'));
  assert.equal(mixed, 'text a\n+1 private');
  assert.equal(buildContent(['a', 'p'], byId, true, text).body, '2 points to keep in mind');
  assert.equal(buildContent(['p'], byId, false, text).body, 'A point to keep in mind');
  assert.equal(buildContent(['gone'], byId, false, text).body, 'A point to keep in mind');
});

// ---- limits, appearances, sky

test('15 per category, and text is cleaned to one short line', () => {
  assert.equal(MAX_PER_CATEGORY, 15);
  assert.ok(canAdd(14) && !canAdd(15));
  assert.equal(cleanText('  drink \n  water  '), 'drink water');
  assert.equal(cleanText('   '), null);
  assert.equal(cleanText('x'.repeat(500))!.length, MAX_TEXT_LENGTH);
});

test('appearances count passed reminders once per point; damaged records read as empty', () => {
  const now = new Date('2026-01-05T12:00:00Z');
  const r = countAppearances([
    { at: '2026-01-05T10:00:00Z', pointIds: ['a', 'b'] },
    { at: '2026-01-05T11:00:00Z', pointIds: ['a', 'a'] },
    { at: '2026-01-05T13:00:00Z', pointIds: ['a'] },
  ], now);
  assert.equal(r.counts.get('a'), 2);
  assert.equal(r.counts.get('b'), 1);
  assert.equal(r.lastAt.get('a'), '2026-01-05T11:00:00Z');
  assert.deepEqual(parseBooked('nope'), []);
  assert.deepEqual(parseBooked('[{"at":"x","pointIds":[1]}]'), []);
});

test('stars grow with appearances, never shrink, keep their place and skip put-away points', () => {
  let prev = 0;
  for (const n of [0, 1, 10, 50, FULL_STAR]) {
    assert.ok(starSize(n) > prev);
    prev = starSize(n);
  }
  assert.equal(starSize(FULL_STAR * 10), 1);
  const pts = Array.from({ length: 8 }, (_, i) => point(`s${i}`, { appearances: 5 }));
  const sky = layoutSky([...pts, point('away', { archived: true, appearances: 99 })]);
  assert.equal(sky.length, 8);
  for (const s of sky) assert.ok(s.x > 0 && s.x < 1 && s.y > 0 && s.y < 1);
  assert.deepEqual(layoutSky([...pts, point('new')]).slice(0, 8), sky);
  assert.equal(totalAppearances(pts), 40);
});
