# open-creativity: design rationale, research and audit

## 1. Research that shaped the plan

- **Forgetting curve.** Modern spaced-repetition schedulers (FSRS and its relatives) model recall as a power function of time since review, scaled by a per-item "stability", defined as the time for recall to fall from 100% to 90%. I use that shape: `R(t) = (1 + F*t/S)^-0.5` with `F = 19/81`, so `R(S) = 0.9`. This is a simplified, explainable cousin, not FSRS: it has no trained parameters and no difficulty model. Sources: [Expertium's FSRS write-up](https://expertium.github.io/Algorithm.html) (states the power curve and the 90% definition; its formula images were not readable, so the exact constants are my own derivation from the 90% anchor, checked by a unit test).
- **Expanding versus equal gaps.** A [meta-analysis in Educational Psychology Review](https://link.springer.com/10.1007/s10648-020-09572-8) found no meaningful difference between expanding and equal-interval retrieval practice (g = 0.034), and that the number of practice tests explained much of the inconsistency. **What this changed:** I stopped selling "expanding intervals" as the benefit. The honest benefit is responding to each point's own forgetting, and sending fewer notifications for points that are solid.
- **Local authentication.** Expo's [LocalAuthentication docs for SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/local-authentication/): Face ID does not work in Expo Go (needs a development build), iOS needs `NSFaceIDUsageDescription`, Android adds `USE_BIOMETRIC` automatically. So app lock can be built and unit-tested as policy now, and only verified later.
- Existing project facts from `docs/SPEC.md`: iOS caps pending notifications at 64, iOS cannot speak from a closed app, Android exact alarms are off the table.

## 2. Plan and audit

**First plan:** a full FSRS port, streak counters with badges, an adaptive planner replacing the current one, voice review, encrypted export, app lock, a lock-screen widget.

**Audit as a sceptic, and what it changed:**

| Concern | Change |
| --- | --- |
| A trained FSRS needs a review history we do not have and a parameter fit that costs CPU and is hard to explain to a user. | Use a small hand-set model (gap, ease, streak, lapses). Explainable in a sentence. |
| The evidence for expanding gaps is weak. | Pitch adaptivity as "responds to your forgetting, quieter for solid points". Daily points cap at 12 hours so they keep drilling. |
| Streaks create guilt and anxiety, against a calm study tone. | "Rhythm" with rest tokens. A miss spends a token first. Dismissing is never counted as a miss. |
| Ignoring a notification is not forgetting. | `dismissed` leaves the gap alone; three in a row only produces a "gentler frequency?" suggestion. |
| The current planner books a fixed grid. Long gaps (days) break that grid, because it restarts every day. | A separate planner books from each point's `nextDueAt`, plus at most 2 follow-ups in case the user ignores the reminder. Rebooking still happens only on the allowed triggers. |
| Every adaptive time is unique, so grouped mode would stop merging points. | Round to 15-minute slots. |
| iOS 64-notification limit. | Same cap of 60 applied to the adaptive output. |
| Auto-moving points between Daily and Long-term. | Not done. Suggestion only, matching the owner's rule. |
| New dependencies (crypto, widgets, local-auth) need approval and device builds. | Only pure logic and policy built. Libraries are proposals. |
| Migration number may collide with the in-flight review-log work. | Migration 3 is isolated to one new table. If another migration lands first, renumber on rebase. |
| Privacy of insights. | Everything is computed on the phone from the review log. The voice script and the sky both honour private mode. No network, no logging of point text. |

## 3. Power, memory and privacy cost

- **New timers, listeners, background tasks: none.** The planner runs only on the already-allowed rebooking triggers. It is O(points x slots scanned), at most about 290 slot checks per point (3 days of 15-minute slots) and 3 reminders per point.
- **Notifications:** an adaptive point books at most 3 pending notifications instead of a daily grid. In the concept, 9 example points go from 15 to 9 in the next 24 hours. That is one example, not a measurement on a phone.
- **Memory:** one small row per point. The sky draws at most 60 Views and has no animation loop.
- **Storage:** one new table, parameter-bound SQL. Points remain unencrypted until a SQLCipher development build exists.

## 4. Known gaps in the prototype

- Unanswered adaptive reminders are reconciled on app open (recorded as `dismissed`, gap kept). If the phone was off or the user was asleep, that can wrongly count as a dismissal. It only nudges the "gentler?" suggestion, never the gap.
- Points on the fixed grid still ignore "Again soon" (no early retry).
- The chain assumes the gap stays constant across follow-ups.
- The constants are untuned. They want a week of real use before anyone trusts them.
- The Labs wiring (review buttons, log, adaptive booking, Memory Sky) is type-checked and bundles, but has not run on a device. Insight suggestions (quiet hours, reword) are built in core but not yet shown in the UI.

## 5. Proposals not built

1. ~~Routine anchors~~ **Built** (section 10).
2. **Lock-screen widget (phase 2).** One point, rotated by the OS. Needs native code through a config plugin, so it waits for the development build.
3. **Encrypted export.** Passphrase-based, nothing leaves the phone unless the user shares the file. Needs an AES library, which is a dependency decision for the owner.
4. ~~"Why now?" line~~ **Built** in a simple form: adaptive cards in Review now show the next gap and the run of remembered answers.
5. **Accessibility pass.** Dynamic type, a 44-point minimum hit area (the sky already uses it), reduce-motion respect, screen-reader summaries of the sky as a plain list, and checked Noto Sans rendering for Hindi and Gujarati.
6. **Question-and-answer points** work with the voice script (prompt, pause, answer) and with a reveal step in the queue; the data model already reserves `kind`, `prompt`, `answer`.

## 6. Alternate look

Concept page ships two themes from one token set: the existing Calm Study paper-and-indigo, and a "Night Sky" dark theme (deep ink background, pale periwinkle stars, warm amber for suggestions). It stays inside the Calm Study family; I did not push a louder style because a study aid used all day should be easy on the eyes.

## 7. Tuning by simulation (not real data)

`node scripts/simulate-adaptive.ts` runs simulated users whose hidden memory does **not** use the model's own curve: recall chance is `0.9^(gap / trueStability)`, true stability multiplies by a growth factor after a success and halves after a failure. 30 days, one Long-term point, mean of 20 seeds, compared with a fixed hourly grid (480 reminders per point).

| First setting (ease start 2.0, max 2.8, step 0.08) | reminders | miss rate |
| --- | --- | --- |
| slow learner (growth 1.3, stability 2 h) | 55 | 0.33 |
| typical (growth 2, stability 2 h) | 9 | 0.13 |
| quick (growth 3, stability 1 day) | 6 | 0.00 |

That was too aggressive: a third of reminders for the slow learner were misses. I tried a middle setting (ease start 1.6, max 2.3, step 0.05) and a cautious one (1.5, 2.0, 0.04). The middle setting gave typical 10 reminders at a 0.06 miss rate and slow learner 47 at 0.27, so it is now the default. The cautious one lowers misses further but never lets gaps stretch past about 19 days. A slow learner still misses about a quarter of reminders, which is the intended behaviour: the gap stays short until the memory holds.

**Limits:** the users are my invention and the numbers say the model behaves sensibly, not that it helps real people. Real tuning needs a few weeks of actual review logs, which the new `review_log` table now collects.

## 8. App lock and voice: decisions and risks

- **Dependencies added (local only, no network, no data collection):** `expo-speech ~58.0.4`, `expo-local-authentication ~58.0.3`, versions from `bundledNativeModules.json` because `npx expo install` is blocked here. **Needs the owner's OK before any merge.** Android adds the `USE_BIOMETRIC` permission through the library; check this against the permission-trimming item in `docs/MEMORY.md`.
- **Lock cannot lock you out:** the switch first checks that a screen lock or biometrics exist, then requires a successful prompt. Turning it on does not lock the current session.
- **Only `background` counts as leaving the app.** The system prompt itself makes the app inactive, so counting that would loop. The cover is also shown while inactive so the app switcher shows no points.
- **Not verified:** Face ID needs a development build (it does not work in Expo Go). The Android prompt behaviour with AppState is untested. Treat the lock as privacy against casual viewing: points are still unencrypted on disk until SQLCipher.
- **Voice:** expo-speech does not document background playback and iOS stays silent in silent mode, so speech is only offered inside Review now while the app is open. Voices come from the phone; the screen warns when a Hindi or Gujarati voice is missing.

## 9. Accessibility pass

- **Contrast is now tested.** `contrast.test.ts` computes WCAG ratios for the Calm Study theme. Measured: light text 14.4, muted text 5.9, accent 7.4, text on accent 7.9; dark text 15.2, muted 7.5, accent 6.9, text on accent 6.9. All pass AA (4.5:1), so the "provisional" dark palette is readable; whether it is the right look is still the owner's call.
- **Memory Sky has a List view.** A tab switches between the sky and a plain list ordered weakest first, with recall as text. A star is a picture; the list carries the same information for screen readers and for anyone who prefers reading. Private mode hides point text in both.
- Stars are 44-point targets with labels naming the point and its recall. Review buttons are at least 44 points tall. Nothing animates, so reduce-motion needs no special case. Text uses default font scaling.
- **Not checked:** behaviour with the largest system font size, TalkBack and VoiceOver on a real phone, and Devanagari and Gujarati font rendering.

## 10. Routine moments

An alternative to the hourly grid: pick four times (defaults 08:00, 12:30, 18:00, 21:00, editable in 30-minute steps in Settings) and the app books one grouped reminder at each, for all ordinary points. Times outside the active hours or in quiet hours are skipped. At most 14 days ahead and 60 notifications, so the iOS limit holds. Adaptive Long-term points keep their own schedule. Against the default grid that is 4 notifications a day instead of 16, with the trade-off of longer gaps between repeats; whether that suits intense drilling is for the owner to judge. Off by default. Not run on a phone.
