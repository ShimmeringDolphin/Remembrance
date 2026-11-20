# YaadOM: Spec

Why the app behaves this way, and the test for new features: [PRODUCT.md](PRODUCT.md).

Status: draft for review. Open questions are listed at the end.

## Summary

One Expo (React Native) app for iPhone, iPad and Android. Everything is stored on the device. A "point" is a short message the user writes. Points are repeated many times a day at a frequency the user controls.

## Delivery

| Channel | Behaviour | Limit |
| --- | --- | --- |
| Notification (default) | Shows the point, with "Remembered" and "Again soon" actions | iOS keeps at most 64 scheduled notifications, so reminders are booked a few days ahead and refilled |
| Widget (phase 2) | Rotates through points on the home and lock screen | Refresh timing is decided by the OS |
| Spoken (opt-in) | Reads the point aloud with the device voice | Only while the app is open; iOS does not let a closed app speak |

Also: quiet hours, per-point and global "private" mode (hides the text on the lock screen), and a "Review now" screen.

## Stack

Expo (React Native, TypeScript). expo-notifications, expo-speech, expo-sqlite with SQLCipher, expo-secure-store, expo-local-authentication, EAS Build and Submit. Widgets are native (SwiftUI, Glance) added through a config plugin in phase 2.

## Data model

See [src/core/types.ts](../src/core/types.ts). Points have `kind` (`note` now, `qa` reserved), `prompt`, optional `answer`, `language`, `category`, `status`, `frequency` and scheduling fields. A review log records each answer. Settings hold the default frequency, active and quiet hours, language, speech and security options.

## Scheduling

- Points repeat through active hours (everything outside quiet hours).
- A frequency is "every N minutes or hours" or "N times a day". Each point uses the default from Settings unless it has its own. Presets (Intense, Regular, Light) fill in the numbers.
- Daily points use the frequency all day. Long-term points use the same kind of frequency with a gentler default. The user moves a point between categories; it never happens automatically.
- Exact rules (implemented in `src/core/scheduler.ts`, tested in `scheduler.test.ts`): each day a point is reminded every interval starting at the first active minute, and the end of the active hours is exclusive (7:00 AM to 10:00 PM at hourly gives 7:00 to 9:00 PM). Reminders that fall in quiet hours are dropped, not moved. Nothing is planned while asleep. "N times a day" spreads evenly over the active minutes. Grouped points that share a time become one notification; individual points are staggered by a stable per-point offset. Times are local; across a daylight-saving change an overnight window may be an hour off.
- Each reminder time is nudged by a few minutes so reminders do not always arrive on the hour. Individual reminders move by up to 3 minutes; grouped reminders by up to 2, the same for every point in the slot so they still arrive together.
- First launch asks for default times or active hours, quiet hours and default frequency. If skipped, the app asks for confirmation before creating reminders at random times.
- Defaults: every hour, active hours 7:00 AM to 10:00 PM (both editable in Settings). An Awake/Sleep button switches reminders on and off by hand; Sleep cancels all booked reminders. The user can choose fixed hours or button-only.
- "Again soon" brings a point back within a few minutes. In v1 answers do not change the set frequency.
- The app books the soonest ~60 reminders across all points and refills on app open, on answering a reminder, and on OS background refresh. At hourly reminders over 16 active hours this lasts about 4 days; at 30 minutes about 2 days.

## Battery and memory

- No background service, polling, wake locks, location or network. Reminders are OS-fired local notifications, so the app uses no battery while idle.
- Android: no exact-alarm permission; a few minutes of drift is fine for study.
- Rebook notifications only on app open, answering a reminder, changing a point or setting, or an OS background refresh (a few a day), in one database transaction.
- Sleep and out-of-hours leave nothing scheduled.
- Minimum interval of 15 minutes (proposed).
- Virtualised lists, no large media, speech loaded only while speaking, widget reads one small snapshot.
- Measure on real phones before release: Android Studio Profiler, `adb` battery stats, Android vitals in Play Console; Xcode gauges and MetricKit on iPhone.
- Notification style (Settings, or per point): `grouped` (default) sends one notification per slot that shows the points themselves, up to 4 lines and "+N more", with a different point leading each hour, and opens the points screen when tapped; `individual` sends one per point with Remembered and Again soon buttons. Grouping keeps many points at hourly frequency to one notification an hour. Private mode, and private points, never show text: a grouped reminder with nothing it may show says only "N points to keep in mind".

## First run, limits and "Your sky"

- First run is one screen: "What do you want to keep in mind?", one box with a rotating example, and Save. Defaults (hourly, 7:00 AM to 10:00 PM, grouped) are already in place. Right after the first save, a short sheet asks for notification permission.
- Each category holds at most 15 points that are not archived. Adding, moving or restoring past that is refused with a friendly note, enforced in the same SQL statement as the write.
- Each rebooking counts the previously booked reminders whose time has passed (only while notification permission is granted) and adds them to each point's `timesShown`. This is approximate: a phone that was off still counts. Stored bookings hold times and ids only.
- "Your sky" appears on the home screen once points have appeared 30 times in total: each point is a star that grows with its appearances and never dims, with one line saying how many times the points have appeared. Nothing to tap or keep up.

## Screens

Welcome and permission flow, Reminder card, Today (review now: a "Review now" button on Home shows the newest active points, and tapping a reminder shows that reminder's points; the Remembered and Again soon buttons are not built yet), Points list (Daily and Long-term tabs), Archived (list of archived points with Restore, and Delete forever after a confirmation; only archived points can be deleted), Add or edit point, Settings. If notification permission is refused, Today shows a banner linking to system settings.

## Languages

English, Hindi, Gujarati. Screen text lives in language files so more can be added. Spoken reminders depend on voices installed on the phone; the app checks and warns if one is missing. Noto Sans is used for Devanagari and Gujarati.

## Security and privacy

No account, no server, no analytics. Encrypted database with the key in Keychain or Keystore. SQLCipher is not available in Expo Go, so it needs a development build; until then (current state) points are stored unencrypted. Optional app lock (Face ID, Touch ID, fingerprint or passcode) with a timeout. Private notification mode. Encrypted password-protected export and import. Device cloud backups excluded by default. Sync, if wanted later, would be end-to-end encrypted.

## Phases

1. Core app: points, frequency scheduling, notifications with actions, Review now, encrypted storage, app lock.
2. Widgets, spoken reminders, quiet hours, private mode, encrypted export and import.
3. Tags and filters, simple stats, onboarding, store listings.
4. Optional: sync, recorded voice clips, question-and-answer points, smarter frequencies.

## Open questions

- Name: YaadOM (chosen; store and trademark availability not yet checked). Bundle ID and package name will be neutral so the display name can change. Style is decided: Calm Study.
- Confirm grouped notifications as the default.
- Default frequency for Long-term points.
- Spoken reminders: read the exact text, or chime plus notification?
- One device or sync across iPhone and iPad?
- Is the iOS limit (about 2 to 4 days of reminders without opening the app) acceptable?
