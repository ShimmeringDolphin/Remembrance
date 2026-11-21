# YaadOM behaviour (source of truth)

The data model lives in `src/core/types.ts`. This file says how the app behaves.

## Points

- A point is one line of up to 200 characters (whitespace collapsed). `kind` is `note`; `qa` and `answer` are reserved.
- Category is **Daily** or **Long-term**. Each holds at most **15** live points. The limit is checked inside the SQL statement that adds, moves or brings back a point.
- A point can be **private** (its words never appear in a notification or on the sky) and can be **put away** (kept, never shown in reminders, not counted toward the limit). Only a put-away point can be deleted for good, after a confirmation.

## Reminders

- Settings: `from` and `to` (may cross midnight, can never be equal from the UI), pace (often 30, regular 60, gentle 120 minutes), pause, private mode, language. Defaults: 07:00 to 22:00, regular, not paused, not private, phone language or English.
- A reminder happens at each pace step inside the window, moved by up to ±2 minutes (deterministic per day and step, never outside the window).
- At most **60** reminders are booked (iOS allows 64), up to 14 days ahead. Paused, an empty window, or no live points books nothing.
- Each reminder shows a **handful of 3** points taking turns, oldest first. When there are Daily and Long-term points, every 3rd reminder swaps one Daily point for a Long-term one. With only Long-term points they take turns 3 at a time. Turn order comes from the reminder's time, so it carries on across rebookings.
- Text: the title is "Keep in mind"; the body lists the points one per line. Private points are replaced by "+ n private". When nothing can be shown (all private, or private mode), the body is only a count.
- Notifications are silent (no sound, no vibration on the Android channel `points`).
- Rebooking happens only when the app opens or returns to the front, and after a point or setting changes. It cancels everything and books again. Runs never overlap; changes during a run trigger one more run.

## Appearances and the sky

- When rebooking, reminders that were booked and whose time has passed count as one appearance for each point in them, in the same transaction that stores the new bookings. This is approximate: a phone that was off still counts.
- **Your sky** appears once the total appearances of live points reach 30. In development builds (testing in Expo Go) it also appears after 3 reminders have passed (`remindersPassed` in `kv`). Up to 30 stars on a golden-angle spiral, oldest in the middle; size grows with appearances (log scale, full at 200) and never shrinks.

## First run

- One screen: a title, a sentence and one box. Keeping the first point (as Daily) asks once whether to turn on reminders, explaining the default times. "Not now" leaves a calm banner on Home with a Turn on button.

## Help and late reminders

- Android without the exact-alarm permission (we do not ask for it) books reminders with `setAndAllowWhileIdle`. While the phone sleeps (Doze) or under maker battery savers, they can be held and shown together on unlock.
- After notifications are allowed on Android, Home shows a one-time card suggesting "Unrestricted" battery use, with a button to the phone's battery page (`android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS`, falling back to the app's settings).
- A Help page answers: late or bundled reminders (Android) or bundled ones (iPhone: Focus, Scheduled Summary), no reminders, no words on the lock screen, battery use, and where points are kept.

## Storage

- SQLite (`yaadom.db`), migrations by `PRAGMA user_version`. Version 1: `points` and `kv` (settings, booked reminders, reminders passed, first-run flags and the battery tip flag). Points are not encrypted yet.
