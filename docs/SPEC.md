# Remembrance: Spec

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
- Each reminder time is nudged by a few minutes so reminders do not always arrive on the hour. Points sharing a slot are interleaved.
- First launch asks for default times or active hours, quiet hours and default frequency. If skipped, the app asks for confirmation before creating reminders at random times.
- "Again soon" brings a point back within a few minutes. In v1 answers do not change the set frequency.
- The app books the soonest ~60 reminders across all points and refills on app open, on answering a reminder, and on OS background refresh. At hourly reminders over 16 active hours this lasts about 4 days; at 30 minutes about 2 days.

## Screens

Welcome and permission flow, Reminder card, Today (review now), Points list (Daily and Long-term tabs), Add or edit point, Settings. If notification permission is refused, Today shows a banner linking to system settings.

## Languages

English, Hindi, Gujarati. Screen text lives in language files so more can be added. Spoken reminders depend on voices installed on the phone; the app checks and warns if one is missing. Noto Sans is used for Devanagari and Gujarati.

## Security and privacy

No account, no server, no analytics. Encrypted database with the key in Keychain or Keystore. Optional app lock (Face ID, Touch ID, fingerprint or passcode) with a timeout. Private notification mode. Encrypted password-protected export and import. Device cloud backups excluded by default. Sync, if wanted later, would be end-to-end encrypted.

## Phases

1. Core app: points, frequency scheduling, notifications with actions, Review now, encrypted storage, app lock.
2. Widgets, spoken reminders, quiet hours, private mode, encrypted export and import.
3. Tags and filters, simple stats, onboarding, store listings.
4. Optional: sync, recorded voice clips, question-and-answer points, smarter frequencies.

## Open questions

- Name and colour style (name ideas: Smaran, Smriti, Yaad, Echo; styles: Calm Study, Focus Dark, Saffron).
- Default frequency for Daily and Long-term points, and active hours.
- Spoken reminders: read the exact text, or chime plus notification?
- One device or sync across iPhone and iPad?
- Is the iOS limit (about 2 to 4 days of reminders without opening the app) acceptable?
