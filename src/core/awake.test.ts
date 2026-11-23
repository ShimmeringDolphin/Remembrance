/// <reference types="node" />
// Awake, Asleep and the hours: the rules of docs "Awake, Asleep and hours: final draft".
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { awakeAction, fullyAsleepDays, goAsleep, goAwake, greetingFor, inWindow, nextStart, planPrompts, sessionTimes, shiftExpiry, statusFor } from './awake.ts';
import { bookReminders, type BookingDeps, type Reminder } from './booking.ts';
import { planTimes } from './planner.ts';
import { defaultSettings, mergeSettings } from './settings.ts';
import type { Point, Settings } from './types.ts';

const at = (day: number, h: number, m = 0) => new Date(2026, 0, day, h, m);
const base = (o: Partial<Settings> = {}): Settings => ({ ...defaultSettings('en'), every: 60, ...o });
const hm = (d: Date) => `${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const asleepAt = (when: Date, o: Partial<Settings> = {}) => goAsleep(base(o), when);

test('inWindow and nextStart on the local clock, including windows that cross midnight', () => {
  assert.equal(inWindow(base(), at(5, 7, 0)), true);
  assert.equal(inWindow(base(), at(5, 22, 0)), false);
  assert.equal(inWindow(base(), at(5, 6, 59)), false);
  assert.equal(inWindow(base({ from: '22:00', to: '02:00' }), at(5, 1, 0)), true);
  assert.equal(inWindow(base({ mode: 'button' }), at(5, 12)), false);
  assert.equal(hm(nextStart(base(), at(5, 6, 0))), '5 07:00');
  assert.equal(hm(nextStart(base(), at(5, 7, 0))), '6 07:00'); // strictly after
  assert.equal(hm(nextStart(base(), at(5, 23, 0))), '6 07:00');
});

test('prompts: three, at the start time and one and two hours later, for the first start after the Asleep tap', () => {
  const s = asleepAt(at(5, 23, 0));
  assert.deepEqual(planPrompts(s, at(5, 23, 0)).map(hm), ['6 07:00', '6 08:00', '6 09:00']);
  // Opening the app at 9:00 once they have passed: nothing again, never rebooked for later mornings.
  assert.deepEqual(planPrompts(s, at(6, 9, 0)), []);
  assert.deepEqual(planPrompts(s, at(6, 7, 30)).map(hm), ['6 08:00', '6 09:00']);
  assert.deepEqual(planPrompts(s, at(7, 6, 0)), []);
});

test('prompts: only Asleep, only Hours mode, only with the switch on', () => {
  const s = asleepAt(at(5, 23));
  assert.deepEqual(planPrompts({ ...s, asleep: false }, at(5, 23)), []);
  assert.deepEqual(planPrompts({ ...s, mode: 'button' }, at(5, 23)), []);
  assert.deepEqual(planPrompts({ ...s, morningPrompt: false }, at(5, 23)), []);
});

test('prompts: one due within 30 minutes of the Asleep tap is skipped', () => {
  const s = asleepAt(at(6, 6, 55));
  assert.deepEqual(planPrompts(s, at(6, 6, 55)).map(hm), ['6 08:00', '6 09:00']);
  const edge = asleepAt(at(6, 6, 30));
  assert.deepEqual(planPrompts(edge, at(6, 6, 30)).map(hm), ['6 07:00', '6 08:00', '6 09:00']);
});

test('prompts: quiet hours push one to the end of the quiet hour, later than Until is dropped, same minute keeps one', () => {
  const quiet = asleepAt(at(5, 23), { quiet: [{ start: '06:30', end: '08:30' }] });
  assert.deepEqual(planPrompts(quiet, at(5, 23)).map(hm), ['6 08:30', '6 09:00']);
  const late = asleepAt(at(5, 12), { from: '20:00', to: '21:30' });
  assert.deepEqual(planPrompts(late, at(5, 12)).map(hm), ['5 20:00', '5 21:00']);
  const short = asleepAt(at(5, 23), { from: '07:00', to: '07:30' });
  assert.deepEqual(planPrompts(short, at(5, 23)).map(hm), ['6 07:00']);
  assert.deepEqual(planPrompts(asleepAt(at(5, 23), { from: '07:00', to: '07:00' }), at(5, 23)), []);
});

test('prompts follow the new start time when the hours change while Asleep', () => {
  const s = asleepAt(at(5, 23));
  assert.deepEqual(planPrompts({ ...s, from: '08:00', to: '22:00' }, at(5, 23)).map(hm), ['6 08:00', '6 09:00', '6 10:00']);
});

test('greeting follows the hour', () => {
  assert.equal(greetingFor(at(5, 7)), 'morning');
  assert.equal(greetingFor(at(5, 12)), 'afternoon');
  assert.equal(greetingFor(at(5, 17)), 'evening');
});

test('Awake: inside hours and All-day just run; in the hour before the start it begins at once with no pop-up', () => {
  assert.equal(awakeAction(base(), at(5, 12)).kind, 'plain');
  assert.equal(awakeAction(base({ mode: 'button' }), at(5, 3)).kind, 'plain');
  const grace = awakeAction(base(), at(5, 6, 10));
  assert.equal(grace.kind, 'grace');
  if (grace.kind === 'grace') assert.equal(hm(new Date(grace.session.end)), '5 07:00');
  assert.equal(awakeAction(base(), at(5, 6, 0)).kind, 'grace'); // exactly one hour before
  assert.equal(awakeAction(base(), at(5, 5, 59)).kind, 'ask');
});

test('Awake outside hours asks 1, 2 or 4 hours; a session never runs into the start time', () => {
  const a = awakeAction(base(), at(5, 23, 0));
  assert.equal(a.kind, 'ask');
  if (a.kind === 'ask') assert.deepEqual(a.options, [1, 2, 4]);
  // At 3:30 the start is 3.5 h away: 1 h, 2 h, and 4 h clipped to 7:00 (3.5 h) are offered.
  const b = awakeAction(base(), at(5, 3, 30));
  if (b.kind === 'ask') {
    assert.deepEqual(b.options, [1, 2, 4]);
    assert.equal(hm(new Date(b.sessions[4].end)), '5 07:00');
  } else assert.fail('ask');
  // At 5:30 the start is 90 min away: 1 h, and 2 h clipped to 90 min; 4 h is the same clip, so not offered twice.
  const c = awakeAction(base(), at(5, 5, 30));
  if (c.kind === 'ask') assert.deepEqual(c.options, [1, 2]);
  else assert.fail('ask');
});

test('Awake: spans shorter than How often, or wholly quiet, are not offered', () => {
  const s = base({ every: 120, quiet: [{ start: '23:00', end: '01:00' }] });
  const a = awakeAction(s, at(5, 22, 30));
  // 1 h < 2 h interval: dropped. 2 h session 22:30 to 00:30: first reminder 22:31, fine. 4 h: fine.
  if (a.kind === 'ask') assert.deepEqual(a.options, [2, 4]);
  else assert.fail('ask');
  const part = awakeAction(base({ quiet: [{ start: '22:00', end: '23:30' }] }), at(5, 22, 30));
  if (part.kind === 'ask') assert.deepEqual(part.options, [2, 4]); // 1 h would end inside the quiet hour
  else assert.fail('ask');
  const allQuiet = awakeAction(base({ quiet: [{ start: '22:00', end: '03:00' }] }), at(5, 22, 30));
  if (allQuiet.kind === 'ask') assert.deepEqual(allQuiet.options, []);
  else assert.fail('ask');
});

test('session times: first reminder one minute after, then every interval, and they feed the planner', () => {
  const session = { start: at(5, 23, 0).toISOString(), end: at(6, 1, 0).toISOString() };
  const s = base({ session, every: 30 });
  assert.deepEqual(sessionTimes(s, at(5, 23, 0), 20).map(hm), ['5 23:01', '5 23:31', '6 00:01', '6 00:31']);
  const times = planTimes(s, at(5, 23, 0), 20).map(hm);
  assert.deepEqual(times.slice(0, 4), ['5 23:01', '5 23:31', '6 00:01', '6 00:31']);
  assert.ok(times.length > 4); // the next day's normal reminders follow
  assert.deepEqual(sessionTimes({ ...s, asleep: true }, at(5, 23), 20), []);
  assert.deepEqual(sessionTimes({ ...s, mode: 'button' }, at(5, 23), 20), []);
});

test('Asleep ends a session at once; Awake in the grace hour starts one', () => {
  const session = { start: at(5, 23, 0).toISOString(), end: at(6, 1, 0).toISOString() };
  const asleep = goAsleep(base({ session }), at(5, 23, 30));
  assert.equal(asleep.session, null);
  assert.equal(asleep.asleep, true);
  assert.equal(asleep.asleepSince, at(5, 23, 30).toISOString());
  assert.deepEqual(planTimes(asleep, at(5, 23, 30)), []);
  const up = goAwake(asleep, at(6, 6, 20));
  assert.equal(up.asleep, false);
  assert.equal(up.asleepSince, null);
  assert.ok(up.session);
  assert.equal(hm(planTimes(up, at(6, 6, 20))[0]), '6 06:21');
  assert.equal(goAwake(asleep, at(6, 23, 0)).session, null); // outside: the pop-up decides
});

test('Daily days: only whole reminder windows asleep count', () => {
  const s = base();
  const created = new Date(2026, 0, 1);
  // Asleep 22:30 to 07:00 every night adds nothing.
  assert.equal(fullyAsleepDays(s, at(5, 22, 30), at(6, 7, 0), created), 0);
  // Asleep 22:30 on the 5th, wake 07:00 on the 8th: the windows of the 6th and 7th are whole.
  assert.equal(fullyAsleepDays(s, at(5, 22, 30), at(8, 7, 0), created), 2);
  // Asleep from before the window on the 6th until after it on the 6th: one.
  assert.equal(fullyAsleepDays(s, at(6, 6, 0), at(6, 22, 0), created), 1);
  assert.equal(fullyAsleepDays(s, at(6, 6, 0), at(6, 21, 59), created), 0);
  // Counted only from the point's creation.
  assert.equal(fullyAsleepDays(s, at(5, 22, 30), at(8, 7, 0), at(7, 6, 0)), 1);
  assert.equal(fullyAsleepDays(s, at(5, 22, 30), at(8, 7, 0), at(7, 8, 0)), 0);
  // All-day mode: whole calendar days.
  assert.equal(fullyAsleepDays(base({ mode: 'button' }), at(5, 22, 0), at(8, 6, 0), created), 2);
  // Windows that cross midnight.
  assert.equal(fullyAsleepDays(base({ from: '20:00', to: '02:00' }), at(5, 12, 0), at(9, 12, 0), created), 4);
  assert.equal(fullyAsleepDays(s, at(8, 6), at(5, 6), created), 0);
});

test('shiftExpiry moves a Daily point\'s last day later by whole days, staying at local midnight', () => {
  const end = new Date(2026, 0, 10).toISOString();
  assert.equal(shiftExpiry(end, 3), new Date(2026, 0, 13).toISOString());
  assert.equal(shiftExpiry(end, 0), end);
});

test('status wording follows the state', () => {
  assert.deepEqual(statusFor(base(), at(5, 12)), { kind: 'inHours', until: '22:00' });
  assert.equal(statusFor(base(), at(5, 23)).kind, 'waiting');
  assert.equal(statusFor(base({ mode: 'button' }), at(5, 23)).kind, 'allDay');
  const session = { start: at(5, 23, 0).toISOString(), end: at(6, 1, 0).toISOString() };
  const s = statusFor(base({ session }), at(5, 23, 30));
  assert.equal(s.kind, 'session');
  // A session cut at the start time hands over to the normal day.
  const grace = { start: at(6, 6, 20).toISOString(), end: at(6, 7, 0).toISOString() };
  assert.deepEqual(statusFor(base({ session: grace }), at(6, 6, 30)), { kind: 'inHours', until: '22:00' });
  const asleep = asleepAt(at(5, 23));
  const a = statusFor(asleep, at(5, 23));
  assert.equal(a.kind, 'asleepPrompt');
  assert.equal(statusFor({ ...asleep, morningPrompt: false }, at(5, 23)).kind, 'asleepNone');
  assert.equal(statusFor({ ...asleep, mode: 'button' }, at(5, 23)).kind, 'asleepNone');
});

test('settings: new fields default, validate, and an old Asleep phone stays Asleep', () => {
  const d = defaultSettings('en');
  assert.deepEqual([d.asleepSince, d.session, d.morningPrompt], [null, null, true]);
  const old = mergeSettings({ asleep: true }, 'en');
  assert.equal(old.asleep, true);
  assert.equal(old.asleepSince, null);
  const s = mergeSettings({ asleep: false, session: { start: 'x', end: 'y' }, asleepSince: 5, morningPrompt: 'no' }, 'en');
  assert.deepEqual([s.session, s.asleepSince, s.morningPrompt], [null, null, true]);
  const ok = mergeSettings({ asleep: false, session: { start: at(5, 23).toISOString(), end: at(6, 1).toISOString() } }, 'en');
  assert.ok(ok.session);
  assert.equal(mergeSettings({ asleep: true, session: { start: at(5, 23).toISOString(), end: at(6, 1).toISOString() } }, 'en').session, null);
  assert.equal(mergeSettings({ session: { start: at(6, 1).toISOString(), end: at(5, 23).toISOString() } }, 'en').session, null);
});

// ---- booking while Asleep ----
const promptText = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', body: "Tap to start today's reminders." };
const text = { title: 'T', privateOne: '1', privateMany: '{n}', privateExtra: '+{n}' };
function point(id: string): Point {
  return { id, kind: 'note', text: `words of ${id}`, answer: null, category: 'daily', private: false, archived: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', appearances: 0, lastAppearedAt: null, expiresAt: null, pace: 'normal', voice: null };
}
function phone(points: Point[]) {
  const scheduled: Reminder[] = [];
  let putAway = 0;
  let recorded: { future: number } | null = null;
  const deps: BookingDeps = {
    readBooked: async () => null,
    listPoints: async () => points,
    putAwayExpired: async () => { putAway++; },
    permissionGranted: async () => true,
    cancelAll: async () => { scheduled.length = 0; },
    countBooked: async () => scheduled.length,
    schedule: async (r) => { scheduled.push(r); },
    record: async (_c, _l, _p, _latest, future) => { recorded = { future: future.length }; },
  };
  return { scheduled, deps, putAway: () => putAway, recorded: () => recorded };
}

test('booking while Asleep: only prompts (at most three), no point text, never recorded as appearances, Daily points not put away', async () => {
  const p = phone([point('a')]);
  const s = asleepAt(at(5, 23));
  const r = await bookReminders(p.deps, s, at(5, 23), 60, text, promptText);
  assert.equal(r.booked, 0);
  assert.equal(r.prompts, 3);
  assert.equal(p.scheduled.length, 3);
  assert.ok(p.scheduled.every((x) => x.prompt === true && x.pointIds.length === 0 && !x.body.includes('words of')));
  assert.deepEqual(p.scheduled.map((x) => x.title), ['Good morning', 'Good morning', 'Good morning']);
  assert.equal(p.recorded()?.future, 0);
  assert.equal(p.putAway(), 0);
  // Awake again: the prompts are cleared and reminders book normally.
  const up = await bookReminders(p.deps, goAwake(s, at(6, 12, 0)), at(6, 12, 0), 60, text, promptText);
  assert.ok(up.booked > 0 && up.prompts === 0);
  assert.ok(p.scheduled.every((x) => !x.prompt));
  assert.equal(p.putAway(), 1);
});

test('booking while Asleep: no prompt without live points, without permission, or without prompt text', async () => {
  const s = asleepAt(at(5, 23));
  assert.equal((await bookReminders(phone([]).deps, s, at(5, 23), 60, text, promptText)).prompts, 0);
  assert.equal((await bookReminders(phone([{ ...point('a'), archived: true }]).deps, s, at(5, 23), 60, text, promptText)).prompts, 0);
  const denied = phone([point('a')]);
  denied.deps.permissionGranted = async () => false;
  assert.equal((await bookReminders(denied.deps, s, at(5, 23), 60, text, promptText)).prompts, 0);
  assert.equal((await bookReminders(phone([point('a')]).deps, s, at(5, 23), 60, text)).prompts, 0);
});

test('booking while Asleep: a rebook after a restart gives the same three, never six', async () => {
  const p = phone([point('a')]);
  const s = asleepAt(at(5, 23));
  await bookReminders(p.deps, s, at(5, 23), 60, text, promptText);
  await bookReminders(p.deps, s, at(5, 23, 30), 60, text, promptText);
  await bookReminders(p.deps, s, at(6, 7, 30), 60, text, promptText);
  assert.deepEqual(p.scheduled.map((x) => hm(x.at)), ['6 08:00', '6 09:00']);
});
