# YaadOM running memory

The project's running list of what is not done yet, what is postponed, and which decisions are still open. `docs/SPEC.md` says how the app behaves; this file says what is left. Update it in the same PR as any change that finishes, defers or adds an item. Last updated: 2026-11-19.

## Open decisions (need the owner)

| Item | Why it matters | Status |
| --- | --- | --- |
| Development build: permanent Android package name (and iOS bundle ID) | Needed for the most reliable notification testing (Expo Go has bugs and its own limits), and later for encrypting points with SQLCipher. The name is permanent once published. | Waiting for the owner. Never pick it without them. |
| Expo account | Needed to make a development build with EAS. | Waiting for the owner. |
| Grouped reminders and private mode | Grouped reminders show only "Time to review: N points". The private switch only affects the one-notification-per-point style. Should grouped reminders show point text when private mode is off? | Waiting for the owner. |
| Exact-alarm timing on Android | Approximate alarms can be delayed a lot when the phone is idle. Exact alarms cost battery, Google Play limits who may use them, and they go against the battery rule in CLAUDE.md. | Decide after the on-charger test below. Needs the development build. |
| App name YaadOM | Store and trademark availability not verified (play.google.com could not be searched). | Open. The name can still change before release. |
| Remove `node_modules` from git history | About 20k files were committed by mistake in PR #4 and untracked in #7. History still holds them. A rewrite changes shared history. | Only with explicit owner approval. |

## Findings to follow up

- Second 15-minute reminder did not arrive on the owner's Android phone (Expo Go). The planner produces a 15-minute sequence when run on a computer, so Android delaying approximate alarms is the leading suspect. Not confirmed on a device. Test: open the app, leave the phone charging with the screen on for about 30 minutes, with Expo Go battery set to Unrestricted.
- Tapping a notification crashed Expo Go before the app had a tap listener. The Review screen adds one, but whether that stops the crash is not known. Test on the phone; a development build is the dependable check.
- Expo Go throws an error when creating the Android notification channel. Made non-fatal in PR #8. Recheck in a development build.

## Deferred and not built yet

- Archived view: archived points cannot be seen or restored today. Add a list with Restore, and Delete forever only after confirmation. Needs DB functions, strings in en/hi/gu and a SPEC update.
- Review Now screen and notification tap handling: built, not tested on a device. Still to build: the Remembered / Again soon buttons and the review log.
- Quiet hours settings: built (PR pending), up to 3 ranges. Not tested on a device.
- Spoken delivery (text to speech), with resources released after use.
- App lock.
- Question-and-answer points (`kind: 'qa'`, `prompt`, `answer` are already in the data model).
- Per-point frequency and notification style editing in the point editor, if not already exposed.
- Encrypted storage (SQLCipher). Needs the development build. Until then do not claim points are encrypted.
- Android permissions: trim the defaults (INTERNET, SYSTEM_ALERT_WINDOW, VIBRATE, storage) before any store release.
- Hindi and Gujarati text is a first draft and needs review by a native speaker before release. The owner reported earlier that those screens were not visible; the language selector (PR #10) is the fix and still needs testing on a phone.
- Dark theme colours are provisional.
- Store listings, privacy policy and anything involving accounts or money need the owner first.

## Not tested on a device

- Everything except the owner's Android phone in Expo Go. Nothing has been run on iPhone or iPad.
- iOS 64-pending-notification limit handling is unit-tested only.
- Battery and memory have not been measured.

## Decisions already made

- Expo (React Native, TypeScript), local-first, no account, no server, no analytics.
- Categories Daily and Long-term. The user moves points manually; never automatic.
- Languages English, Hindi, Gujarati. Style Calm Study.
- Default repeat every hour, minimum 15 minutes. Default active hours 7:00 AM to 10:00 PM, plus an Awake/Sleep button.
- Notification style default grouped, with one-per-point as an option.
- Library versions are pinned from `node_modules/expo/bundledNativeModules.json` because `npx expo install` is blocked in the cloud sandbox.

## Daily point expiry (2026-11-21)

- Built from the owner's request: Daily points repeat 1 to 6 days (default 1) then archive with their entry date; more than 6 days saves as Long-term after a notice. This is my reading of the request and needs the owner's confirmation. Daily points that existed before it never expire. Not tested on a device.
- Quiet hours have no settings screen yet (the scheduler supports any number of ranges; the default is none). Sleep is the Awake/Sleep button, not a quiet hour.
