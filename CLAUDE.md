# YaadOM (repo: Remembrance)

A study aid for iPhone, iPad and Android. It repeats the user's own short points many times a day. Read `docs/SPEC.md` first: it is the source of truth for behaviour, and `src/core/types.ts` is the source of truth for the data model.

## How to work

- **Plan thoroughly, then audit the plan.** Before building anything non-trivial, write the plan and review it as a sceptic would: what could be wrong, what was left out, what it costs in battery, memory, privacy and complexity. Say what the audit changed.
- **Assume nothing; verify.** Check Expo, React Native and library APIs against the current docs for the installed SDK (see `AGENTS.md`) instead of memory. Run the checks below after every change, and say exactly what ran and what did not. Never say something works on a phone unless it was run on one.
- **Security, power and memory come first.** Treat them as requirements, not polish (rules below).
- **Ask before irreversible or outward-facing steps**: setting the iOS bundle ID or Android package name (permanent once published), adding a dependency that touches the network or collects data, store listings, and anything involving accounts or money.
- Keep pull requests small and stacked only when needed; say in each one what is not included and what was not tested on a device.

## Checks (run before every push)

```bash
npm ci
npx tsc --noEmit                                   # typecheck, strict
npm test                                           # unit tests (node:test), in src/core
npx expo export --platform android --output-dir /tmp/yaadom-export   # confirms it bundles
```

Add unit tests for pure logic as soon as it exists, especially the reminder scheduler (frequency, active hours, quiet hours, Awake/Sleep, the iOS 64-notification limit). Fix a bug with a test that fails first.

## Security and privacy

- Local-first: no account, no server, no analytics, no ads, no third-party SDKs. Do not add network calls without asking.
- Never log point text or put it in crash reports, URLs or analytics. Notification text must respect private mode (show only a count).
- Secrets and keys go in Keychain or Keystore through expo-secure-store, never in the database, code or git.
- Points are stored unencrypted until a development build with SQLCipher exists; do not claim they are encrypted before then.
- Use parameter binding for every SQL query. Never build SQL from user text.
- Request the minimum permissions (notifications only unless the spec says more).

## Power and memory

- No background service, polling, wake locks, location or network. Reminders are OS-scheduled local notifications.
- Android: no exact-alarm permission. Rebook notifications only on app open, answering a reminder, changing a point or setting, or an OS background refresh, in one transaction.
- Sleep and out-of-hours leave nothing scheduled. Respect the minimum interval and the iOS limit of 64 scheduled notifications.
- Use virtualised lists, load only what is on screen, no large media, release speech and other resources after use.
- Any feature that adds timers, listeners or background tasks needs a note in its PR on the cost and how it was measured.

## Code conventions

- Files in `src/core` are plain TypeScript with no Expo or React Native imports so `npm test` can run them under Node. Relative runtime imports inside `src/core` need the `.ts` extension (type-only imports do not).
- Expo with TypeScript, strict mode. Add packages with `npx expo install`; if that is blocked, use the versions in `node_modules/expo/bundledNativeModules.json`.
- Database changes are versioned migrations in `src/db/database.ts` using `PRAGMA user_version`. Never edit a migration that has shipped; add a new one. Update `src/core/types.ts` and `docs/SPEC.md` in the same PR as the change.
- Single-line points today, but keep `kind`, `prompt` and `answer` so question-and-answer points can be added without a rewrite.
- All user-visible text goes through `src/i18n/strings.ts` in English, Hindi and Gujarati. Hindi and Gujarati text needs review by a native speaker before release. No hard-coded strings in components.
- Colours come from `src/theme/calmStudy.ts` (light and dark). Keep screens simple and readable; accessibility labels on every button.

## Git

- Branch from `main`, commit with clear messages, open a pull request for review. Never push to `main`, rewrite shared history or skip checks.
