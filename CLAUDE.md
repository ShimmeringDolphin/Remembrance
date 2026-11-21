# YaadOM (fresh start)

A calm study aid for iPhone, iPad and Android that brings the user's own short points back through the day. Read `docs/PRODUCT.md` (why) and `docs/SPEC.md` (behaviour) first; `src/core/types.ts` is the data model.

## Design principles (check every feature against them)

Serve the passive user first: someone who writes a few lines and never taps or configures anything. The reminder must be complete on its own, goodwill is protected (quiet, few, no guilt words), content stays fresh, and smart or recall features are opt-in with plain repetition as the fallback.

## How to work

- Plan, then audit the plan as a sceptic (battery, memory, privacy, complexity, the passive user). Say what the audit changed.
- Verify Expo and library APIs against the installed SDK (`AGENTS.md`), not memory. Never claim something works on a phone unless it ran on one.
- Ask before irreversible or outward-facing steps: bundle ID or package name, any dependency that touches the network or collects data, store listings, accounts or money.

## Checks (before every push)

```bash
npm ci
npx tsc --noEmit
npm test
npx expo export --platform android --output-dir /tmp/yaadom-export
```

Pure logic gets unit tests (node:test). Fix a bug with a test that fails first.

## Rules

- Local-first: no account, server, analytics, ads or third-party SDKs. Never log point text.
- Bound parameters for every SQL query. Migrations are versioned; never edit a shipped one.
- No background service, polling, timers or wake locks. Reminders are OS-scheduled; at most 60 booked; no exact-alarm permission.
- `src/core` is plain TypeScript with no Expo or React Native imports; relative runtime imports there use `.ts`.
- All visible text goes through `src/i18n/strings.ts` (English, Hindi, Gujarati; the latter two need native review). Colours come from `src/theme/calmStudy.ts`. Accessibility labels on every control.
- Branch, commit clearly, open a pull request. Never push to `main`.
