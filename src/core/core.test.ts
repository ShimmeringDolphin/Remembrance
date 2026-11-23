/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countAppearances, parseBooked } from './appearances.ts';
import { buildContent } from './content.ts';
import { canAdd, cleanText, MAX_PER_CATEGORY, MAX_TEXT_LENGTH } from './limits.ts';
import { DAYS_AHEAD, fillTimes, HANDFUL, JITTER_MINUTES, LONG_TERM_EVERY, MAX_BOOKED, MAX_BOOKED_ANDROID, planSlots, planTimes } from './planner.ts';
import { defaultSettings, EVERY_CHOICES, mergeSettings } from './settings.ts';
import { FULL_STAR, layoutSky, skyUnlocked, starSize, totalAppearances } from './sky.ts';
import { formatTime, parseTime, shiftTime, windowLength } from './time.ts';
import { activeAt, expiryFor, lastDayOf, resolveDays } from './expiry.ts';
import { addQuiet, inQuiet, MAX_QUIET, removeQuiet, setQuiet } from './quiet.ts';
import { isPace, paceFor, paceWindows } from './pace.ts';
import { listenSteps } from './moment.ts';
import { widgetSlot } from './widget.ts';
import { freshIds, listenQueue, momentPoints, starGrowth } from './moment.ts';
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
    updatedAt: '2026-01-01T00:00:00.000Z', appearances: 0, lastAppearedAt: null, expiresAt: null, pace: 'normal', voice: null, ...o,
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

test('defaults are hourly 07:00 to 22:00, awake, not private, not read aloud, silent', () => {
  assert.deepEqual(defaultSettings('hi'), { from: '07:00', to: '22:00', every: 60, asleep: false, mode: 'hours', quiet: [], privateMode: false, language: 'hi', readAloud: false, sound: false, asleepSince: null, session: null, morningPrompt: true });
  assert.equal(mergeSettings({ sound: true }, 'en').sound, true);
  assert.equal(mergeSettings({ sound: 'yes' }, 'en').sound, false);
});

test('stored settings keep valid values and fall back on junk', () => {
  assert.equal(mergeSettings({ from: '06:30', pace: 'often', privateMode: true }, 'en').from, '06:30');
  // Older settings: a named pace and a pause flag carry over.
  const old = mergeSettings({ pace: 'often', paused: true }, 'en');
  assert.equal(old.every, 30);
  assert.equal(old.asleep, true);
  assert.equal(mergeSettings({ every: 45 }, 'en').every, 45);
  for (const junk of [null, 3, 'x', [], { from: '99:00', pace: 'fast', every: 7, paused: 'yes', asleep: 1, readAloud: 'y', language: 'fr' }]) {
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

test('every choice from 15 to 180 minutes sets the gap between reminders, roughly', () => {
  for (const gap of EVERY_CHOICES) {
    const pace = gap;
    const t = planTimes({ ...settings, every: gap, to: '23:59' }, at(5, 6), 4);
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

test('asleep or an empty window books nothing; the iOS cap and the horizon hold', () => {
  assert.deepEqual(planTimes({ ...settings, asleep: true }, at(5, 0)), []);
  assert.deepEqual(planTimes({ ...settings, from: '08:00', to: '08:00' }, at(5, 0)), []);
  assert.equal(planTimes({ ...settings, every: 30 }, at(5, 0)).length, MAX_BOOKED);
  assert.equal(planTimes({ ...settings, every: 15 }, at(5, 0), MAX_BOOKED_ANDROID).length, MAX_BOOKED_ANDROID);
  const far = planTimes({ ...settings, every: 120, from: '12:00', to: '13:00' }, at(5, 0), 1000);
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
  assert.equal(r.passed, 2);
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

test('the sky opens at 30 appearances, or after 3 reminders only while testing', () => {
  const few = [point('a', { appearances: 2 })];
  assert.equal(skyUnlocked(few, 3, false), false);
  assert.equal(skyUnlocked(few, 2, true), false);
  assert.equal(skyUnlocked(few, 3, true), true);
  assert.equal(skyUnlocked([point('b', { appearances: 30 })], 0, false), true);
});

test('a moment glows on Home for 90 minutes after its reminder, then stops', () => {
  const now = new Date('2026-01-05T12:00:00Z');
  const latest = { at: '2026-01-05T11:00:00Z', pointIds: ['a', 'b'] };
  assert.deepEqual([...freshIds(latest, now)], ['a', 'b']);
  assert.equal(freshIds(latest, new Date('2026-01-05T12:31:00Z')).size, 0);
  assert.equal(freshIds({ at: '2026-01-05T13:00:00Z', pointIds: ['a'] }, now).size, 0);
  assert.equal(freshIds(null, now).size, 0);
  const r = countAppearances([{ at: '2026-01-05T10:00:00Z', pointIds: ['x'] }, latest, { at: '2026-01-05T13:00:00Z', pointIds: ['y'] }], now);
  assert.deepEqual(r.latest, latest);
});

test('a moment keeps reminder order, skips put-away and missing points; stars only grow', () => {
  const pts = [point('a'), point('b', { archived: true }), point('c', { appearances: 4 })];
  assert.deepEqual(momentPoints(['c', 'b', 'zz', 'a', 'c'], pts).map((p) => p.id), ['c', 'a']);
  const g = starGrowth(pts[2]);
  assert.ok(g.to > g.from);
  assert.equal(starGrowth(point('new')).from, starGrowth(point('new')).to);
});

test('listening never speaks private or put-away points', () => {
  const pts = [point('b'), point('a', { private: true }), point('c', { archived: true })];
  assert.deepEqual(listenQueue(pts).map((p) => p.id), ['b']);
});

test('a reminder with a Long-term point is coloured as Long-term', () => {
  const byId = new Map([point('d'), point('l', { category: 'long_term' })].map((p) => [p.id, p]));
  const text = { title: 'T', privateOne: '1', privateMany: '{n}', privateExtra: '+{n}' };
  assert.equal(buildContent(['d'], byId, false, text).category, 'daily');
  assert.equal(buildContent(['d', 'l'], byId, false, text).category, 'long_term');
});

// ---- from main: Daily expiry (#17, #19) and quiet hours (#20)

test('Daily points repeat 1 to 6 days counting today; more becomes Long-term', () => {
  assert.deepEqual(resolveDays(1), { days: 1, longTerm: false });
  assert.deepEqual(resolveDays(6), { days: 6, longTerm: false });
  assert.deepEqual(resolveDays(7), { days: 7, longTerm: true });
  assert.deepEqual(resolveDays(0), { days: 1, longTerm: false });
  assert.deepEqual(resolveDays(Number.NaN), { days: 1, longTerm: false });
  const end = expiryFor(new Date(2026, 0, 5, 15, 30), 1);
  assert.deepEqual(end, new Date(2026, 0, 6));
  assert.deepEqual(lastDayOf(end.toISOString()), new Date(2026, 0, 5));
  assert.equal(lastDayOf(null), null);
  assert.equal(activeAt(end.toISOString(), new Date(2026, 0, 5, 23, 59)), true);
  assert.equal(activeAt(end.toISOString(), new Date(2026, 0, 6)), false);
});

test('a Daily point is never booked at or after its expiry', () => {
  const now = at(5, 6);
  const end = expiryFor(now, 1).toISOString();
  const slots = planSlots([point('short', { expiresAt: end }), point('keep')], { ...settings, to: '23:59' }, now, 200);
  const after = slots.filter((s) => s.at.getTime() >= Date.parse(end));
  assert.ok(after.length > 0);
  for (const s of after) assert.ok(!s.pointIds.includes('short'));
  assert.ok(slots.some((s) => s.at.getTime() < Date.parse(end) && s.pointIds.includes('short')));
  // When the only point has expired, nothing more is booked.
  const only = planSlots([point('x', { expiresAt: end })], settings, now, 200);
  assert.ok(only.every((s) => s.at.getTime() < Date.parse(end)));
});

test('quiet hours drop reminders inside them, including ranges across midnight', () => {
  assert.equal(inQuiet(13 * 60, [{ start: '13:00', end: '14:00' }]), true);
  assert.equal(inQuiet(14 * 60, [{ start: '13:00', end: '14:00' }]), false);
  assert.equal(inQuiet(23 * 60 + 30, [{ start: '23:00', end: '06:00' }]), true);
  assert.equal(inQuiet(5 * 60, [{ start: '23:00', end: '06:00' }]), true);
  assert.equal(inQuiet(7 * 60, [{ start: '23:00', end: '06:00' }]), false);
  assert.equal(inQuiet(600, [{ start: '10:00', end: '10:00' }]), false);
  const times = planTimes({ ...settings, quiet: [{ start: '12:00', end: '15:00' }] }, at(5, 6), 15);
  for (const t of times) assert.ok(t.getHours() < 12 || t.getHours() >= 15 || (t.getHours() === 11), `${t}`);
  // Nothing is prefilled: a quiet time is added only with the times the user picked.
  let r = addQuiet([], { start: '13:00', end: '14:00' });
  assert.deepEqual(r, [{ start: '13:00', end: '14:00' }]);
  assert.deepEqual(addQuiet([], { start: 'x', end: '14:00' } as never), []);
  r = setQuiet(r, 0, 'end', '15:30');
  assert.equal(r[0].end, '15:30');
  for (let i = 0; i < 5; i++) r = addQuiet(r, { start: '01:00', end: '02:00' });
  assert.equal(r.length, MAX_QUIET);
  assert.equal(removeQuiet(r, 0).length, MAX_QUIET - 1);
  assert.equal(mergeSettings({ quiet: [r[0], { start: 'x' }, r[1], r[2], r[0]] }, 'en').quiet.length, MAX_QUIET);
});

test('button mode reminds all day while Awake; Asleep always wins', () => {
  const day = planTimes({ ...settings, mode: 'button', every: 60 }, at(5, 0), 200).filter((t) => t.getDate() === 5);
  assert.ok(day.length >= 23, `${day.length}`);
  assert.ok(day.some((t) => t.getHours() < 7) && day.some((t) => t.getHours() >= 22));
  assert.deepEqual(planTimes({ ...settings, mode: 'button', asleep: true }, at(5, 0)), []);
  assert.deepEqual(planTimes({ ...settings, mode: 'hours', asleep: true }, at(5, 0)), []);
});

test('turns stay fair in half-hour and quarter-hour time zones, and with a :30 start', () => {
  const saved = process.env.TZ;
  try {
    for (const tz of ['Asia/Kolkata', 'Asia/Kathmandu', 'UTC']) {
      process.env.TZ = tz;
      for (const from of ['07:00', '07:30']) {
        const s = { ...settings, from };
        const pts = Array.from({ length: 7 }, (_, i) => point(`f${i}`));
        const seen = new Map<string, number>();
        for (const slot of fillTimes(planTimes(s, new Date(2026, 0, 5, 0, 0), 60), pts, s)) {
          for (const id of slot.pointIds) seen.set(id, (seen.get(id) ?? 0) + 1);
        }
        const counts = [...seen.values()];
        assert.ok(Math.max(...counts) - Math.min(...counts) <= 2, `${tz} ${from}: ${counts}`);
      }
    }
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
});

test('a Daily point set to Often comes back about twice as much as Normal', () => {
  const pts = [point('often', { pace: 'often' }), ...Array.from({ length: 6 }, (_, i) => point(`n${i}`))];
  const s = { ...settings, mode: 'button' as const, every: 15 };
  const seen = new Map<string, number>();
  for (const slot of fillTimes(planTimes(s, at(5, 0), 400), pts, s)) {
    assert.equal(new Set(slot.pointIds).size, slot.pointIds.length, 'a point twice in one reminder');
    for (const id of slot.pointIds) seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  const normal = [0, 1, 2, 3, 4, 5].map((i) => seen.get(`n${i}`) ?? 0);
  const avg = normal.reduce((a, b) => a + b, 0) / normal.length;
  assert.ok(Math.max(...normal) - Math.min(...normal) <= 2, `normal unfair: ${normal}`);
  const often = (seen.get('often') ?? 0) / avg;
  assert.ok(often > 1.6 && often < 2.4, `often ${often}`);
});

test('Every reminder: up to two Daily points in every Daily reminder, the rest still take turns', () => {
  const pts = [point('e1', { pace: 'every' }), point('e2', { pace: 'every' }), point('e3', { pace: 'every' }), ...Array.from({ length: 4 }, (_, i) => point(`r${i}`)), point('lt', { category: 'long_term' })];
  const slots = fillTimes(planTimes(settings, at(5, 0), 60), pts, settings);
  const seen = new Map<string, number>();
  for (const slot of slots) {
    assert.ok(slot.pointIds.length <= HANDFUL);
    assert.equal(new Set(slot.pointIds).size, slot.pointIds.length);
    assert.ok(slot.pointIds.includes('e1') && slot.pointIds.includes('e2'), `missing every point: ${slot.pointIds}`);
    for (const id of slot.pointIds) seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  // The third "every" point is past the limit and takes turns; so do the others and Long-term.
  for (const id of ['e3', 'r0', 'r1', 'r2', 'r3']) assert.ok((seen.get(id) ?? 0) > 0, id);
  assert.ok((seen.get('lt') ?? 0) > 0);
});

test('Long-term points keep Often, Normal and Rarely: about twice and about half', () => {
  const lt = (id: string, pace: Point['pace'] = 'normal') => point(id, { category: 'long_term', pace });
  const pts = [lt('often', 'often'), ...Array.from({ length: 5 }, (_, i) => lt(`n${i}`)), lt('rarely', 'rarely')];
  const s = { ...settings, mode: 'button' as const, every: 15 };
  const seen = new Map<string, number>();
  for (const slot of fillTimes(planTimes(s, at(5, 0), 400), pts, s)) {
    assert.equal(new Set(slot.pointIds).size, slot.pointIds.length);
    for (const id of slot.pointIds) seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  const normal = [0, 1, 2, 3, 4].map((i) => seen.get(`n${i}`) ?? 0);
  const avg = normal.reduce((x, y) => x + y, 0) / normal.length;
  const often = (seen.get('often') ?? 0) / avg;
  const rarely = (seen.get('rarely') ?? 0) / avg;
  assert.ok(often > 1.6 && often < 2.4, `often ${often}`);
  assert.ok(rarely > 0.35 && rarely < 0.65, `rarely ${rarely}`);
  // Values from the other category read as the nearest one: Every on Long-term is Often, Rarely on Daily is Normal.
  assert.equal(paceFor({ category: 'long_term', pace: 'every' }), 'often');
  assert.equal(paceFor({ category: 'daily', pace: 'rarely' }), 'normal');
  assert.equal(paceFor({ category: 'daily', pace: 'every' }), 'every');
});

test('when every point has the same pace, turns are exactly as before', () => {
  const base = Array.from({ length: 5 }, (_, i) => point(`p${i}`));
  const times = planTimes(settings, at(5, 0), 60);
  const normal = fillTimes(times, base, settings);
  for (const pace of ['often'] as const) {
    assert.deepEqual(fillTimes(times, base.map((p) => ({ ...p, pace })), settings), normal);
  }
  // Plain round-robin in age order, three to a reminder.
  const order = paceWindows(base, 3).flat().map((p) => p.id);
  assert.deepEqual(order.slice(0, 10), ['p0', 'p1', 'p2', 'p3', 'p4', 'p0', 'p1', 'p2', 'p3', 'p4']);
  assert.equal(isPace('often'), true);
  assert.equal(isPace('fast'), false);
  assert.equal(isPace('rarely'), true);
});

test('listen hands runs of points to the phone voice and plays own recordings one by one', () => {
  const a = point('a'), b = point('b'), c = point('c', { voice: 'c.m4a' }), d = point('d'), e = point('e', { voice: 'e.m4a' });
  const steps = listenSteps([a, b, c, d, e]);
  assert.deepEqual(steps.map((s) => (s.kind === 'own' ? `own:${s.point.id}` : `phone:${s.points.map((p) => p.id).join('')}`)), ['phone:ab', 'own:c', 'phone:d', 'own:e']);
  assert.deepEqual(listenSteps([]), []);
});

test('the widget shows the reminder that came last, else the next one', () => {
  const now = at(5, 12);
  const b = (h: number, id: string) => ({ at: at(5, h).toISOString(), pointIds: [id] });
  assert.equal(widgetSlot([b(10, 'a'), b(11, 'b'), b(13, 'c')], null, now)?.pointIds[0], 'b');
  assert.equal(widgetSlot([b(13, 'c'), b(14, 'd')], b(9, 'old'), now)?.pointIds[0], 'old');
  assert.equal(widgetSlot([b(14, 'd'), b(13, 'c')], null, now)?.pointIds[0], 'c');
  assert.equal(widgetSlot([], null, now), null);
  assert.equal(widgetSlot([{ at: 'junk', pointIds: ['x'] }], null, now), null);
});
