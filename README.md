# YaadOM

Write a short line once. YaadOM brings it back to you as quiet notifications through the day, a few points at a time. Nothing to tick off.

```bash
npm ci
npx expo start        # scan the QR code with Expo Go (SDK 58)
npm test              # unit tests
```

See `docs/PRODUCT.md` for why it works this way and `docs/SPEC.md` for exact behaviour.

Local notifications need a real phone; Expo Go on Android may limit them, so a development build is the reliable way to test reminders.

## Test build on an Android phone (YaadOM-Sky)

Expo Go handles notification taps itself, so test reminders in a standalone build. It uses the test-only app ID `dev.yaadom.sky.test`, which is never published.

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

The first build asks to create the project on your Expo account and to generate an Android keystore; say yes to both. When it finishes, open the link or scan the QR code on the phone to install the APK.
