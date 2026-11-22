/// <reference types="node" />
// The notification side, end to end, against a fake phone. Nothing here needs Expo or a device.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBooked, type Booked } from './appearances.ts';
import { bookReminders, type BookingDeps, type Reminder } from './booking.ts';
import { arrivals, judgeTiming, LATE_MINUTES, reminderData, showTimingTip, TIP_PAUSE_DAYS, type Presented } from './lateness.ts';
import { MAX_BOOKED, MAX_BOOKED_ANDROID } from './planner.ts';
import { defaultSettings, EVERY_CHOICES } from './settings.ts';
import { inQuiet } from './quiet.ts';
import { parseTime, windowLength } from './time.ts';
import type { Point, Settings } from './types.ts';

const text = { title: 'Keep in mind', privateOne: '1 point to keep in mind', privateMany: '{n} points to keep in mind', privateExtra: '+ {n} private' };
const at = (day: number, h: number, m = 0) => new Date(2026, 0, day, h, m);
let seq = 0;
function point(id: string, o: Partial<Point> = {}): Point {
  seq++;
  return {
    id, kind: 'note', text: `words of ${id}`, answer: null, category: 'daily', private: false, archived: false,
    createdAt: `2026-01-01T00:${String(Math.floor(seq / 60) % 60).padStart(2, '0')}:${String(seq % 60).padStart(2, '0')}.000Z`,
    updatedAt: '2026-01-01T00:00:00.000Z', appearances: 0, lastAppearedAt: null, expiresAt: null, pace: 'normal', voice: null, ...o,
  };
}

/** A phone: keeps what is booked and what was stored, and can be told to fail. */
class FakePhone {
  scheduled: Reminder[] = [];
  kvBooked: string | null = null;
  recorded = 0;
  cancelCalls = 0;
  permission: boolean | 'throws' = true;
  listThrows = false;
  failSchedule = (_n: number) => false;
  points: Point[];
  private n = 0;
  constructor(points: Point[]) {
    this.points = points;
  }
  deps(): BookingDeps {
    return {
      readBooked: async () => this.kvBooked,
      listPoints: async () => {
        if (this.listThrows) throw new Error('db');
        return this.points;
      },
      putAwayExpired: async () => {},
      permissionGranted: async () => {
        if (this.permission === 'throws') throw new Error('permission');
        return this.permission;
      },
      cancelAll: async () => {
        this.cancelCalls++;
        this.scheduled = [];
      },
      schedule: async (r) => {
        if (this.failSchedule(this.n++)) throw new Error('refused');
        this.scheduled.push(r);
      },
      record: async (_c, _l, _p, _latest, future) => {
        this.recorded++;
        this.kvBooked = JSON.stringify(future);
      },
    };
  }
  run(settings: Settings, now: Date, limit = MAX_BOOKED_ANDROID) {
    return bookReminders(this.deps(), settings, now, limit, text);
  }
}

const twoPoints = () => [point('a'), point('b')];

test('booking: every reminder is in the future, in order, unique, within the cap, with words and ids', async () => {
  const phone = new FakePhone(twoPoints());
  const now = at(5, 9, 30);
  const r = await phone.run(defaultSettings('en'), now, MAX_BOOKED_ANDROID);
  assert.equal(r.aborted, false);
  assert.equal(r.failed, 0);
  assert.equal(r.booked, phone.scheduled.length);
  assert.ok(phone.scheduled.length > 0 && phone.scheduled.length <= MAX_BOOKED_ANDROID);
  const times = phone.scheduled.map((s) => s.at.getTime());
  assert.ok(times.every((t) => t > now.getTime()), 'a reminder in the past');
  assert.deepEqual([...times].sort((x, y) => x - y), times, 'out of order');
  assert.equal(new Set(times).size, times.length, 'two reminders at one moment');
  for (const s of phone.scheduled) {
    assert.ok(s.pointIds.length > 0);
    assert.ok(s.body.includes('words of'));
  }
  assert.deepEqual(parseBooked(phone.kvBooked).map((b) => b.at), phone.scheduled.map((s) => s.at.toISOString()));
});

test('booking: asleep, no permission, no points and an empty window book nothing, and clear the old reminders', async () => {
  const cases: [string, (p: FakePhone) => Settings][] = [
    ['asleep', () => ({ ...defaultSettings('en'), asleep: true })],
    ['no permission', (p) => ((p.permission = false), defaultSettings('en'))],
    ['no points', (p) => ((p.points = []), defaultSettings('en'))],
    ['all put away', (p) => ((p.points = twoPoints().map((x) => ({ ...x, archived: true }))), defaultSettings('en'))],
    ['empty window', () => ({ ...defaultSettings('en'), from: '09:00', to: '09:00' })],
  ];
  for (const [name, setup] of cases) {
    const phone = new FakePhone(twoPoints());
    await phone.run(defaultSettings('en'), at(5, 6));
    assert.ok(phone.scheduled.length > 0, `${name}: setup`);
    const settings = setup(phone);
    const r = await phone.run(settings, at(5, 6));
    assert.equal(phone.scheduled.length, 0, `${name}: still booked`);
    assert.equal(r.booked, 0, name);
    assert.equal(r.aborted, false, name);
  }
});

test('booking: a failing step before the cancel leaves the old reminders in place', async () => {
  for (const fail of ['permission', 'list'] as const) {
    const phone = new FakePhone(twoPoints());
    await phone.run(defaultSettings('en'), at(5, 6));
    const before = phone.scheduled.map((s) => s.at.getTime());
    const recordedBefore = phone.recorded;
    const bookedJson = phone.kvBooked;
    if (fail === 'permission') phone.permission = 'throws';
    else phone.listThrows = true;
    const r = await phone.run(defaultSettings('en'), at(5, 6, 5));
    assert.equal(r.aborted, true, fail);
    assert.deepEqual(phone.scheduled.map((s) => s.at.getTime()), before, `${fail}: bookings were wiped`);
    assert.equal(phone.recorded, recordedBefore, `${fail}: stored list was replaced`);
    assert.equal(phone.kvBooked, bookedJson);
  }
});

test('booking: reminders the phone refuses are skipped, the rest are booked and stored', async () => {
  const phone = new FakePhone(twoPoints());
  phone.failSchedule = (n) => n % 3 === 0;
  const r = await phone.run(defaultSettings('en'), at(5, 6));
  assert.ok(r.failed > 0 && r.booked > 0);
  assert.equal(r.booked, phone.scheduled.length);
  assert.equal(parseBooked(phone.kvBooked).length, r.booked);
  assert.equal(phone.recorded, 1);
});

test('booking: running again books the same reminders once, never twice', async () => {
  const phone = new FakePhone(twoPoints());
  await phone.run(defaultSettings('en'), at(5, 9));
  const first = phone.scheduled.map((s) => `${s.at.toISOString()}|${s.pointIds}`);
  for (let i = 0; i < 4; i++) await phone.run(defaultSettings('en'), at(5, 9));
  assert.deepEqual(phone.scheduled.map((s) => `${s.at.toISOString()}|${s.pointIds}`), first);
  assert.equal(phone.cancelCalls, 5);
});

test('booking: reminders that have passed are counted once and dropped from the stored list', async () => {
  const phone = new FakePhone(twoPoints());
  await phone.run(defaultSettings('en'), at(5, 6));
  const stored = parseBooked(phone.kvBooked);
  const counted: number[] = [];
  const deps = phone.deps();
  deps.record = async (_c, _l, passed, _latest, future) => {
    counted.push(passed);
    phone.kvBooked = JSON.stringify(future);
  };
  await bookReminders(deps, defaultSettings('en'), at(5, 12, 30), MAX_BOOKED_ANDROID, text);
  const passedExpected = stored.filter((b) => Date.parse(b.at) <= at(5, 12, 30).getTime()).length;
  assert.equal(counted[0], passedExpected);
  assert.ok(parseBooked(phone.kvBooked).every((b: Booked) => Date.parse(b.at) > at(5, 12, 30).getTime()));
  // Counted again on the next run? No: they are gone from the list.
  await bookReminders(deps, defaultSettings('en'), at(5, 12, 31), MAX_BOOKED_ANDROID, text);
  assert.ok(counted[1] <= 1, `counted again: ${counted[1]}`);
});

test('booking: private points and private mode never put words into a reminder or its data', async () => {
  const phone = new FakePhone([point('a', { private: true }), point('b'), point('c')]);
  await phone.run(defaultSettings('en'), at(5, 6));
  assert.ok(phone.scheduled.every((s) => !s.body.includes('words of a')));
  const priv = new FakePhone(twoPoints());
  await priv.run({ ...defaultSettings('en'), privateMode: true }, at(5, 6));
  for (const s of priv.scheduled) {
    assert.ok(!s.body.includes('words of'));
    const data = JSON.stringify(reminderData(s));
    assert.ok(!data.includes('words of'));
    assert.deepEqual(Object.keys(reminderData(s)).sort(), ['at', 'pointIds']);
  }
});

/** A small seeded generator, so a failure can be reproduced. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('booking: 600 random settings, clocks and time zones always keep the rules', async () => {
  const saved = process.env.TZ;
  const rand = rng(20261122);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const hhmm = () => `${String(Math.floor(rand() * 24)).padStart(2, '0')}:${pick(['00', '15', '30', '45'])}`;
  try {
    for (let i = 0; i < 600; i++) {
      process.env.TZ = pick(['UTC', 'Asia/Kolkata', 'Asia/Kathmandu', 'America/New_York', 'Pacific/Auckland', 'Australia/Lord_Howe']);
      const settings: Settings = {
        ...defaultSettings('en'),
        from: hhmm(),
        to: hhmm(),
        every: pick(EVERY_CHOICES),
        mode: pick(['hours', 'button'] as const),
        asleep: rand() < 0.1,
        privateMode: rand() < 0.2,
        quiet: rand() < 0.4 ? [{ start: hhmm(), end: hhmm() }] : [],
      };
      const pts = Array.from({ length: 1 + Math.floor(rand() * 8) }, (_, k) => point(`p${i}-${k}`, { category: rand() < 0.3 ? 'long_term' : 'daily' }));
      const now = new Date(2026, Math.floor(rand() * 12), 1 + Math.floor(rand() * 28), Math.floor(rand() * 24), Math.floor(rand() * 60));
      const limit = pick([MAX_BOOKED, MAX_BOOKED_ANDROID]);
      const phone = new FakePhone(pts);
      const r = await phone.run(settings, now, limit);
      const label = JSON.stringify({ i, tz: process.env.TZ, settings, now: now.toISOString(), limit });
      assert.equal(r.aborted, false, label);
      assert.ok(phone.scheduled.length <= limit, `cap ${label}`);
      if (settings.asleep) assert.equal(phone.scheduled.length, 0, `asleep ${label}`);
      const win = windowLength(settings.from, settings.to);
      if (settings.mode === 'hours' && win === 0) assert.equal(phone.scheduled.length, 0, `empty window ${label}`);
      let prev = 0;
      for (const s of phone.scheduled) {
        const t = s.at.getTime();
        assert.ok(t > now.getTime(), `past ${label}`);
        assert.ok(t > prev, `order or duplicate ${label}`);
        prev = t;
        assert.ok(s.pointIds.length > 0 && s.pointIds.length <= 3, `handful ${label}`);
        assert.equal(new Set(s.pointIds).size, s.pointIds.length, `repeat in one reminder ${label}`);
        const minute = s.at.getHours() * 60 + s.at.getMinutes();
        assert.ok(!inQuiet(minute, settings.quiet), `in quiet hours ${label}`);
        if (settings.mode === 'hours') {
          const from = parseTime(settings.from);
          const rel = (((minute - from) % 1440) + 1440) % 1440;
          assert.ok(rel < win, `outside the window ${label}`);
        }
      }
    }
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
});

test('booking: how long the booked reminders last if the app is not opened', async () => {
  // Reminders are booked ahead only; the app rebooks when opened. Report and bound the runway.
  const rows: string[] = [];
  const runway = async (settings: Settings, limit: number) => {
    const phone = new FakePhone([point('a'), point('b'), point('c'), point('d')]);
    const now = at(5, 6);
    await phone.run(settings, now, limit);
    const last = phone.scheduled[phone.scheduled.length - 1];
    return (last.at.getTime() - now.getTime()) / 86400000;
  };
  const base = defaultSettings('en');
  const cases: [string, Settings, number][] = [
    ['default, hourly 07-22, Android', base, MAX_BOOKED_ANDROID],
    ['default, hourly 07-22, iPhone', base, MAX_BOOKED],
    ['every 15 min 07-22, Android', { ...base, every: 15 }, MAX_BOOKED_ANDROID],
    ['every 15 min all day, Android', { ...base, every: 15, mode: 'button' }, MAX_BOOKED_ANDROID],
    ['every 15 min all day, iPhone', { ...base, every: 15, mode: 'button' }, MAX_BOOKED],
  ];
  const days: Record<string, number> = {};
  for (const [name, s, limit] of cases) {
    const d = await runway(s, limit);
    days[name] = d;
    rows.push(`${name}: ${d.toFixed(1)} days`);
  }
  console.log(`# runway without opening the app\n# ${rows.join('\n# ')}`);
  assert.ok(days['default, hourly 07-22, Android'] >= 7);
  assert.ok(days['default, hourly 07-22, iPhone'] >= 3.5);
});

// ---- timing check

const due = (day: number, h: number, m = 0) => at(day, h, m);
const posted = (d: Date, delayMin: number, data: unknown = undefined): Presented => ({
  date: d.getTime() + delayMin * 60000,
  data: data ?? reminderData({ pointIds: ['a'], at: d }),
});

test('timing: reminders on time are not late', () => {
  const list = [9, 10, 11, 12].map((h) => posted(due(5, h), 0.4));
  const t = judgeTiming(arrivals(list), at(5, 12, 5));
  assert.equal(t.late, false);
  assert.equal(t.together, false);
  assert.equal(showTimingTip(t, null, at(5, 12, 5)), false);
});

test('timing: reminders held back and shown together on opening are caught', () => {
  const opened = at(5, 12, 3);
  const list: Presented[] = [8, 9, 10, 11, 12].map((h) => ({ date: opened.getTime() + (h - 8) * 1000, data: reminderData({ pointIds: ['a'], at: due(5, h) }) }));
  const t = judgeTiming(arrivals(list), at(5, 12, 5));
  assert.equal(t.late, true);
  assert.equal(t.together, true);
  assert.ok(t.worstMinutes >= 180, `${t.worstMinutes}`);
  assert.equal(showTimingTip(t, null, at(5, 12, 5)), true);
});

test('timing: inexact alarms that drift late are caught; one small slip is not', () => {
  const drifting = [8, 9, 10, 11].map((h, i) => posted(due(5, h), 12 + i * 11));
  assert.equal(judgeTiming(arrivals(drifting), at(5, 12)).late, true);
  const slip = [posted(due(5, 8), 0.2), posted(due(5, 9), 3), posted(due(5, 10), 0.3)];
  assert.equal(judgeTiming(arrivals(slip), at(5, 12)).late, false);
  assert.equal(judgeTiming(arrivals([posted(due(5, 8), LATE_MINUTES + 1)]), at(5, 12)).late, false, 'one 11-minute delay is not enough');
  assert.equal(judgeTiming(arrivals([posted(due(5, 8), 45)]), at(5, 12)).late, true, 'one very late reminder is');
});

test('timing: old notifications, damaged data and second-based dates are handled', () => {
  const old = [posted(due(1, 8), 300), posted(due(1, 9), 300), posted(due(1, 10), 300)];
  assert.equal(judgeTiming(arrivals(old), at(5, 12)).late, false, 'older than a day');
  const junk: Presented[] = [{ date: NaN, data: {} }, { date: 5, data: null }, { date: Date.now(), data: { at: 'x' } }, { date: Date.now(), data: { pointIds: ['a'] } }];
  assert.deepEqual(arrivals(junk), []);
  const seconds: Presented = { date: Math.round((due(5, 8).getTime() + 3 * 3600000) / 1000), data: reminderData({ pointIds: ['a'], at: due(5, 8) }) };
  assert.equal(arrivals([seconds])[0].lateMinutes, 180);
});

test('timing: the tip waits three days after it is dismissed', () => {
  const late = judgeTiming(arrivals([8, 9, 10].map((h) => posted(due(5, h), 90))), at(5, 12));
  assert.equal(late.late, true);
  const dismissed = at(5, 12).getTime();
  assert.equal(showTimingTip(late, dismissed, at(6, 12)), false);
  assert.equal(showTimingTip(late, dismissed, at(5 + TIP_PAUSE_DAYS + 1, 12)), true);
});

test('timing: a phone model that holds alarms, one that drifts and an exact one are told apart', () => {
  const opened = at(5, 14);
  const dues = [8, 9, 10, 11, 12, 13].map((h) => due(5, h));
  const rand = rng(7);
  const exact = dues.map((d) => posted(d, rand()));
  const drift = dues.map((d) => posted(d, rand() * 60));
  const held = dues.map((d, i) => ({ date: opened.getTime() + i * 800, data: reminderData({ pointIds: ['a'], at: d }) }));
  const now = new Date(opened.getTime() + 60000);
  const [e, d, h] = [exact, drift, held].map((l) => judgeTiming(arrivals(l), now));
  assert.equal(e.late, false);
  assert.equal(d.late, true);
  assert.equal(d.together, false);
  assert.equal(h.late, true);
  assert.equal(h.together, true);
});
