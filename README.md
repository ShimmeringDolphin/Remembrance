# YaadOM

(Repository name: Remembrance. The app name can change later.)

A study aid for iPhone, iPad and Android that repeats your own short "points of remembrance" many times through the day, so what you want to learn stays in mind. It is not a to-do reminder: repetition is the whole point.

Status: early development. You can add, edit, archive and list points (Daily and Long-term), stored on the phone. Reminders are scheduled as local notifications (hourly by default, 7:00 AM to 10:00 PM), with an Awake/Sleep button and a Settings screen for frequency, active hours, notification style and private mode. Not built yet: the Review now screen (tapping a notification just opens the app), Remembered / Again soon buttons, quiet hours settings, spoken delivery and the app lock. Points are not yet encrypted (see docs/SPEC.md).

## Run it

```bash
npm install
npx expo start      # then open in Expo Go on your phone
npx tsc --noEmit    # typecheck
```

Bundle ID (iOS) and package name (Android) are not set yet. They will be chosen, neutral and permanent, before the first store build.

## How it works

- You write short points (one line each for now).
- Each point is **Daily** (what you are drilling now) or **Long-term** (kept fresh, repeated more gently). You move a point from Daily to Long-term yourself.
- Points repeat through your active hours. Set one default frequency for all points, or a frequency per point (every N minutes or hours, or N times a day).
- Delivery: local notifications (with "Remembered" and "Again soon" buttons), a widget, and optional spoken reminders.
- Languages in v1: English, Hindi, Gujarati.
- Local-first and private: everything stays on the phone, encrypted, with an optional biometric lock. No account.

## Docs

- [docs/SPEC.md](docs/SPEC.md): stack, data model, scheduling, screens, security, phases, open questions.

## Planned stack

Expo (React Native, TypeScript) with expo-notifications, expo-speech, expo-sqlite (encrypted), expo-secure-store and expo-local-authentication.
