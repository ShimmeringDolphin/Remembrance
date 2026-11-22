# YaadOM behaviour (source of truth)

The data model lives in `src/core/types.ts`. This file says how the app behaves.

## Points

- A point is one line of up to 200 characters (whitespace collapsed). `kind` is `note`; `qa` and `answer` are reserved.
- Category is **Daily** or **Long-term**. Each holds at most **15** live points. The limit is checked inside the SQL statement that adds, moves or brings back a point.
- A point can be **private** (its words never appear in a notification or on the sky) and can be **put away** (kept, never shown in reminders, not counted toward the limit). Only a put-away point can be deleted for good, after a confirmation.
- Each **Daily** point has a **pace** (`pace`: `every`, `often` or `normal`, default `normal`), set on its page. `every` puts it in every Daily reminder (at most 2 such points, oldest first, so one place keeps rotating; a third takes turns as Often). Rotating points share the other places Often 2 : Normal 1, by evenly spaced due times. Long-term points have no pace choice and always take normal turns; moving a point resets its pace. How often in Settings stays the base and sets the number of reminders. Home tags Daily points that are not Normal. Migration 3 adds `pace`; an older `rarely` reads as Normal.

## Daily points that stop (from main PRs #17 and #19)

- When adding a Daily point, "Repeat for" sets 1 to 6 days, counting today (default 1). Its `expiresAt` is local midnight after the last day. Choosing 7+ saves it as Long-term, which never stops.
- Expired points are put away whenever reminders are rebooked (app open, return to the front, any change). The planner never books a point at or after its expiry.
- Bringing a point back or moving it to Long-term clears its expiry. Points written before this change never expire (migration 2 adds `expires_at`).
- Cards show "Last day: today" or the date.
- In a moment, **Done** on the last point is unavailable for 5 seconds (dimmed, with a short note), so a reminder is not closed before it is read.

## Reminders

- Settings: `from` and `to` (may cross midnight, can never be equal from the UI), `every` (15, 30, 45, 60, 90, 120 or 180 minutes), private mode, read aloud, language. Defaults: 07:00 to 22:00, every 60 minutes, awake, not private, not read aloud, phone language or English. Older stored `pace` and `paused` values carry over.
- **Awake/Asleep** sits at the top of Home. Asleep books nothing until the user taps Awake, and always wins.
- **When** (Settings) has two modes: "Between my hours" (default: reminders only from From to Until) and "All day, until I tap Asleep" (`mode: 'button'`, reminders around the clock while Awake). Times are set with the phone's own picker (tap the time) or nudged by 30 minutes with − and +.
- **Quiet hours** (from main PR #20): up to 3 daily ranges (may cross midnight) with no reminders. Nothing is prefilled: "Add quiet hours" asks for the start and then the end with the phone's picker (Android: two clock dialogs, "Set start" then "Set end"; iPhone: both wheels in one sheet), and adds the range only when both are chosen.
- A reminder happens at each pace step inside the window, moved by up to ±2 minutes (deterministic per day and step, never outside the window).
- At most **60** reminders are booked on iOS (it allows 64) and **120** on Android (it allows 500 alarms per app), up to 14 days ahead. Asleep, an empty window, or no live points books nothing.
- Each reminder shows a **handful of 3** different points taking turns, oldest first. Turns are spread by stride scheduling over each point's share (`src/core/pace.ts`); when all points share a pace this is plain round-robin. When there are Daily and Long-term points, every 3rd reminder swaps one Daily point for a Long-term one. With only Long-term points they take turns 3 at a time. Turn order comes from the reminder's time, so it carries on across rebookings.
- Text: the title is "Keep in mind"; the body lists the points one per line. Private points are replaced by "+ n private". When nothing can be shown (all private, or private mode), the body is only a count.
- Notifications are silent by default (no sound, no vibration on the Android channel `points`). Settings > Voice > **Gentle sound** (`sound`, off by default) books them on the channel `points-gentle` with a soft generated chime (`assets/sounds/gentle.wav`, about 1.6 s, no vibration); on iPhone the same file is the notification sound.
- Any settings change except read aloud rebooks.
- **Latest reminder**: recorded on every rebook and whenever a reminder arrives while the app is open. "Go through the latest reminder" rebooks first, then opens it, and hides once gone through until a newer reminder comes (`seenShown` in kv). The glow lasts 90 minutes.
- Rebooking happens only when the app opens or returns to the front, and after a point or setting changes. It cancels everything and books again. Runs never overlap; changes during a run trigger one more run.

## Moments, colour and voice

- Each notification carries only the ids of its points (`data.pointIds`). Tapping it opens a **moment**: the points one at a time on cards in their category's colour (Daily marigold, Long-term peacock), with Next and Read aloud. Nothing to mark. The last view shows every star, with this moment's stars growing from their size before this appearance.
- The latest reminder that has passed is stored as `lastShown` in `kv`. For 90 minutes its points glow on Home with "Just came back", and Home offers "Go through the latest reminder".
- Android notifications use the category colour as their accent (Long-term when the reminder holds a Long-term point).
- **Read aloud** uses the phone's text-to-speech (expo-speech; en-IN, hi-IN, gu-IN), started only by a tap or the "read aloud" setting. Private points are never read automatically.
- **Listen to all my points** on Home hands every live, non-private point to the phone's voice at once, in order, so it reads them one after another. It stops when tapped again or when the app leaves the screen.

## Appearances and the sky

- When rebooking, reminders that were booked and whose time has passed count as one appearance for each point in them, in the same transaction that stores the new bookings. This is approximate: a phone that was off still counts.
- **Your sky** appears once the total appearances of live points reach 30. In test builds (Expo Go, or an APK built with `EXPO_PUBLIC_TESTING=1`, as the `preview` profile in `eas.json` does) it also appears after 3 reminders have passed (`remindersPassed` in `kv`). Up to 30 stars on a golden-angle spiral, oldest in the middle; size grows with appearances (log scale, full at 200) and never shrinks.

## First run

- One screen: a title, a sentence and one box. Keeping the first point (as Daily) asks once whether to turn on reminders, explaining the default times. "Not now" leaves a calm banner on Home with a Turn on button.

## Help and late reminders

- Android without the exact-alarm permission (we do not ask for it) books reminders with `setAndAllowWhileIdle`. While the phone sleeps (Doze) or under maker battery savers, they can be held and shown together on unlock.
- After notifications are allowed on Android, Home shows a one-time card suggesting "Unrestricted" battery use, with a button to the phone's battery page (`android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS`, falling back to the app's settings).
- A Help page answers: late or bundled reminders (Android) or bundled ones (iPhone: Focus, Scheduled Summary), no reminders, no words on the lock screen, battery use, and where points are kept.

## Storage

- SQLite (`yaadom.db`), migrations by `PRAGMA user_version`. Version 1: `points` and `kv`; version 2 adds `points.expires_at`; version 3 adds `points.pace`; version 4 adds `points.voice` (settings, booked reminders, reminders passed, first-run flags and the battery tip flag). Points are not encrypted yet.

## Your own voice

- A point's page can record it in the user's own voice: Record, Stop (30 seconds at most), Play, Record again, Remove recording. Mono AAC at 64 kbps (about 240 KB per 30 s).
- Recordings are files in the app's documents folder (`voices/`), not encrypted, never sent anywhere; the file name is in `points.voice`. Replacing or removing a recording deletes the old file, and deleting a point for good deletes its file. Putting a point away keeps it.
- Read aloud in a moment and Listen play the recording instead of the phone's voice. Private points are never read aloud either way.
- The microphone is used only between Record and Stop. expo-audio is configured with no background playback or recording (no foreground service). Android asks for RECORD_AUDIO the first time Record is tapped.

## Home-screen widget (Android)

- "Keep in mind" widget (4 x 2 cells, resizable): the points of the reminder that came last, or before the first one the next one, with the same privacy rules as a notification (private points and private mode show only a count). Tapping it opens the app.
- Redrawn whenever the app rebooks reminders and by Android at most once an hour (`updatePeriodMillis` 3,600,000), through a headless task that only reads the database. No iPhone widget yet (needs a WidgetKit extension).
