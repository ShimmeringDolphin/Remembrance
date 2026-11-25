# YaadOM behaviour (source of truth)

The data model lives in `src/core/types.ts`. This file says how the app behaves.

## Points

- A point is one line of up to 200 characters (whitespace collapsed). `kind` is `note`; `qa` and `answer` are reserved.
- Category is **Daily** or **Long-term**. Each holds at most **15** live points. The limit is checked inside the SQL statement that adds, moves or brings back a point.
- A point can be **private** (its words never appear in a notification or on the sky) and can be **put away** (kept, never shown in reminders, not counted toward the limit). Only a put-away point can be deleted for good, after a confirmation.
- Each point has a **pace** (`pace`), set on its page; default `normal`. Daily: `every` (in every Daily reminder; at most 2 such points, oldest first, so one place keeps rotating; a third takes turns as Often), `often` or `normal`. Long-term: `often`, `normal` or `rarely`. Rotating shares are Often 4 : Normal 2 : Rarely 1, by evenly spaced due times. A value from the other category reads as the nearest one (Every as Often, Rarely as Normal); moving a point resets its pace. How often in Settings stays the base and sets the number of reminders. Home tags points that are not Normal. Migration 3 adds `pace`.

## Daily points that stop (from main PRs #17 and #19)

- When adding a Daily point, "Repeat for" sets 1 to 6 days, counting today (default 1). Its `expiresAt` is local midnight after the last day. Choosing 7+ saves it as Long-term, which never stops.
- Expired points are put away whenever reminders are rebooked (app open, return to the front, any change). The planner never books a point at or after its expiry.
- Bringing a point back or moving it to Long-term clears its expiry. Points written before this change never expire (migration 2 adds `expires_at`).
- Cards show "Last day: today" or the date.
- In a moment, **Next** and **Done** (and tapping the card) are unavailable for 5 seconds on every point (dimmed, with a short note), so no point is skipped before it is read.

## Reminders

- Settings: `from` and `to` (may cross midnight, can never be equal from the UI), `every` (15, 30, 45, 60, 90, 120 or 180 minutes), private mode, read aloud, language. Defaults: 07:00 to 22:00, every 60 minutes, awake, not private, not read aloud, phone language or English. Older stored `pace` and `paused` values carry over.
- **Awake/Asleep** sits at the top of Home. Asleep always wins and stays until the user taps Awake; it books no reminders. Their screen-reader labels say what a tap does.
  - **Wake-up prompts.** Tapping Asleep (Hours mode, Settings switch "Prompt after Asleep", on by default) books up to three silent notifications: at the first start time (From) after the tap, one hour later and two hours later. Text: "Good morning/afternoon/evening" and "Tap to start today's reminders." (no point text, never counted as appearances). Quiet hours push one to the end of the quiet range; one later than Until is dropped; two on the same minute keep one; one due within 30 minutes of the tap is skipped. They follow the current From if the hours change, are never rebooked for later mornings, and need live points and notification permission. All-day mode has none. Tapping a prompt only opens a sheet with an "I'm awake, start" button (same as Awake). Android deep sleep or Force stop can remove them (Help answer 7).
  - **Awake** inside the hours, or in All-day mode: reminders resume. In the hour before From: reminders begin at once and run up to From (a "session"), no pop-up. Anywhere else: a pop-up asks 1, 2 or 4 hours (spans clipped at From, shorter than How often or with no reminder outside quiet hours not offered, "Not now" changes nothing). A session's first reminder is one minute later, then every How often. Tapping Asleep ends it. The session (`settings.session`) is saved, not in memory.
  - **Daily points while Asleep** are not put away. On Awake each Daily point's last day moves later by the number of whole reminder windows spent Asleep (from the later of the Asleep tap and the point's creation), so Asleep each night adds nothing and a three-day break adds three days (`fullyAsleepDays`, `shiftDailyExpiry`).
  - **Home line**: "Awake. Reminders until 10:00 PM.", "Awake until 1:00 AM.", "Awake. Reminders start at 7:00 AM. Tap Awake to start now.", "Asleep. A prompt comes at 7:00 AM." (or the plain Asleep note when none). Logic in `src/core/awake.ts`.
- **When** (Settings) has two modes: "Between my hours" (default: reminders only from From to Until) and "All day, until I tap Asleep" (`mode: 'button'`, reminders around the clock while Awake). Times are set with the phone's own picker (tap the time) or nudged by 30 minutes with − and +.
- **Quiet hours** (from main PR #20): up to 3 daily ranges (may cross midnight) with no reminders. Nothing is prefilled: "Add quiet hours" asks for the start and then the end with the phone's picker (Android: two clock dialogs, "Set start" then "Set end"; iPhone: both wheels in one sheet), and adds the range only when both are chosen.
- A reminder happens at each pace step inside the window, moved by up to ±2 minutes (deterministic per day and step, never outside the window).
- At most **60** reminders are booked on iOS (it allows 64) and **120** on Android (it allows 500 alarms per app), up to 14 days ahead. Asleep books only the (at most three) wake-up prompts; an empty window or no live points books nothing.
- Each reminder shows a **handful of 3** different points taking turns, oldest first. Turns are spread by stride scheduling over each point's share (`src/core/pace.ts`); when all points share a pace this is plain round-robin. When there are Daily and Long-term points, every 3rd reminder swaps one Daily point for a Long-term one. With only Long-term points they take turns 3 at a time. Turn order comes from the reminder's time, so it carries on across rebookings.
- Text: the title is "Keep in mind"; the body lists the points one per line. Private points are replaced by "+ n private". When nothing can be shown (all private, or private mode), the body is only a count.
- Notifications are silent by default (no sound, no vibration on the Android channel `points`). Settings > Voice > **Gentle sound** (`sound`, off by default) books them on the channel `points-gentle` with a soft generated chime (`assets/sounds/gentle.wav`, about 1.6 s, no vibration); on iPhone the same file is the notification sound.
- Any settings change except read aloud rebooks.
- **Latest reminder**: recorded on every rebook and whenever a reminder arrives while the app is open. "Go through the latest reminder" rebooks first, then opens it, and hides once gone through until a newer reminder comes (`seenShown` in kv). The glow lasts 90 minutes.
- Rebooking happens only when the app opens or returns to the front, and after a point or setting changes. It cancels everything and books again. Runs never overlap; a call during a run triggers one more run with the newest settings (`src/core/serialLatest.ts`). Nothing is booked until the saved settings have been read at start-up (a cold start used to book with the default Awake settings, which woke a phone that was put to sleep). Everything that can fail (reading the points, the permission check, planning) runs before the cancel, so a failure leaves the old reminders booked instead of wiping them (`src/core/booking.ts`, tested with a fake phone). The one exception is Asleep, which always wins: it cancels first, before any read that could fail, and then checks that nothing is left booked, cancelling again if the phone kept any. Each reminder's data carries only `{pointIds, at}`, `at` being the time it is due; a prompt carries `{prompt: true, promptAt}`.
- **Runway:** reminders are booked ahead only, and the app rebooks when opened, so a phone left unopened runs out: about 7.6 days with the defaults on Android (3.6 on iPhone), 1.7 days at every 15 minutes between 07:00 and 22:00, 1.2 days (Android) or 0.6 days (iPhone) at every 15 minutes all day.

## Moments, colour and voice

- Each notification carries only the ids of its points (`data.pointIds`). Tapping it opens a **moment**: the points one at a time on cards in their category's colour (Daily marigold, Long-term peacock), with Next and Read aloud. Nothing to mark. The last view shows every star, with this moment's stars growing from their size before this appearance.
- The latest reminder that has passed is stored as `lastShown` in `kv`. For 90 minutes its points glow on Home with "Just came back", and Home offers "Go through the latest reminder".
- Android notifications use the category colour as their accent (Long-term when the reminder holds a Long-term point).
- **Read aloud** uses the phone's text-to-speech (expo-speech; languages en, hi, gu, passed as bare codes because Android rejects region codes), started only by a tap or the "read aloud" setting. A point is split by script and each part is read in its own voice, one after another (Devanagari in Hindi, Gujarati script in Gujarati, Latin letters in English), so a line that mixes them is read properly whatever the app language is; the app language is used only when a point has no letters. If the phone has no voice for a language in the point (checked with the engine's voice list), a short line on the card says so and where to add it (Settings, General management, Text-to-speech, the gear next to the engine, Install voice data). Several points read one after another (Listen, or a moment with more than one point) are one chain: each part waits for the one before it, and a part the engine cannot read is skipped without silencing the rest. Each language reads with a voice chosen from the engine's list (an offline voice first, then an Indian one), because a network voice is slow to start at every language switch; the test panel shows the voice chosen for each. Test builds show the voice counts for English, Hindi and Gujarati in the Settings test panel, and a button there adds one Long-term point for every pair of the three languages in both orders, each language alone and all three, to hear the voices. Private points are never read automatically.
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
- Each answer shows two lines, and a longer one ends its second line with "... Read more", which opens it; "See less" below closes it. Answers that fit in two lines show no link.
- Test builds only: Settings ends with a TEST PANEL showing how many reminders the phone holds, the next three due times (never point text), how many of them are wake-up prompts, and whether the app is Asleep, with a Refresh button. It reads on open and on Refresh; no timers.
- Every page has a ⋮ menu at the top right: Home shows Help and Settings, Help shows Home and Settings, Settings shows Home and Help. The Sky page keeps only its Back button.
- Once the sky exists, a round Sky button (three stars: bright five-point, dimmer four-point, dimmest three-point; still, never animated) sits beside the ⋮ on Home. It replaces the old Sky card. Uses `react-native-svg`, bundled with the Expo SDK, no network.
- The Gujarati Awake and Asleep buttons read "જાગું છું" and "સૂઉં છું".

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

## Late reminders (Android)

- Booked reminders use `setAndAllowWhileIdle` (inexact) because the app has no exact-alarm permission; the library uses exact alarms only when `canScheduleExactAlarms()` is true. Android's documentation says inexact alarms may arrive up to an hour late, and during Doze or battery saving they are held. Samsung's "Deep sleeping apps" "only work when you open them", and Samsung keeps its own "Never sleeping apps" list, apart from Android's battery optimisation page.
- **Timing check** (`src/core/lateness.ts`, `src/notify/timing.ts`): when the app opens or returns to the front, it reads the notifications still in the tray. Android stamps each with the time the phone posted it (`postTime`) and each carries its due time `at`, so posted minus due is the delay. A reminder 10 minutes or more late counts as late; the tip appears when two do, or one is 30 minutes or more late, among those that arrived in the last 24 hours. Several late ones posted within 2 minutes of each other with due times spread over 10 minutes or more are the sign of a phone holding reminders back.
- The tip on Home says what to change (battery use "Unrestricted"; on Samsung also turn off "Put unused apps to sleep" and add the app to "Never sleeping apps") and has Open battery settings and Not now. After Not now it is not shown again for 3 days. It reads only times, never words, and runs no timer or listener.
- The Help answer and the battery tip carry the same Samsung steps. The path is Settings, Battery and device care, Battery, Background usage limits.

- Pages (Settings, Help, Your sky) share one header: a back arrow (‹, labelled "Back") on the left, the title centred, the menu on the right.
- Opening the latest reminder in the app (the Home button) takes its notification out of the notification shade (`dismissSeen`, matching the reminder's due time). Tapping the notification itself already clears it.
- The per-point "How often" explanation is kept to one short line pair.

- **Notification shade.** Reminders carry a thread/group key (`threadIdentifier: 'reminders'`), so Android stacks them under one entry. When a reminder arrives while the app is open, and when the app opens or returns to the front, older reminder notifications are taken out and only the newest stays (`tidyShade`, after the late-timing check which reads them). Wake-up prompts and the note below are left alone. Long text already expands: expo-notifications sets Android's BigTextStyle.
- **Keep-coming note.** One place in the booking cap (limit minus one) is kept for a silent note two minutes after the first reminder due at least 48 hours after the app was last opened (every rebook), or after the last booked reminder when the booked ones end sooner (for example every 15 minutes all day, about 30 hours). Text: "Keep your reminders coming. Open YaadOM-Sky once so your reminders carry on." No point text, never an appearance, not booked while Asleep. It never comes at night (outside From to Until in Hours mode; 11 PM to From in All-day mode) or in a quiet hour: it then waits for the first minute that is neither (your From time, or the end of the quiet hour). Because every open rebooks and moves it two days on, a user who opens the app within two days never sees it. Data `{runway: true, runwayAt}`.
- Considered and not built: spacing reminders out when the app is not opened (the booked reminders already run out, and the note says so) and a catch-up moment (the latest-reminder button and Home already show what came). A "Got it" notification button needs background code, which the rules forbid.
