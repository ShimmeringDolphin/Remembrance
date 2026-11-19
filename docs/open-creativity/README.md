# open-creativity: exploration summary

A sandbox branch for pushing YaadOM's product thinking further. Nothing here is merged into `main`, and nothing touches the in-flight scaffold or wireframe work. Edits to existing code: an additive `isActiveMinute` export in `scheduler.ts`, migrations 3 and 4, a `labs` field in Settings, and the Labs wiring listed below.

**Try it first:** the interactive [Memory Sky concept](concept/index.html) (open the file in a browser). It runs the real planner, memory and queue code from `src/core`, not a mock.

## The idea in one paragraph

Today every point repeats on the same fixed grid. Memory does not work like that: a point you know cold wastes notifications, and one you keep losing needs more help. YaadOM can learn each point's own gap from the two taps it already plans (Remembered, Again soon) and nothing else. That also makes the phone quieter, because a stable point books one reminder instead of sixteen a day. The user stays in charge: nothing moves between Daily and Long-term by itself, and every smart behaviour is a suggestion or an opt-in.

## What is built (prototype, unit-tested, not run on a phone)

| Piece | File | What it does |
| --- | --- | --- |
| Adaptive spacing | `src/core/labs/memory.ts` | Per-point gap that stretches on Remembered, shrinks on Again soon, ignores dismissals. Power-law forgetting curve gives a "chance you still recall it" number. |
| Adaptive planner | `src/core/labs/adaptivePlan.ts` | Books each point from its own due time into shared 15-minute slots so grouped mode still merges points. Output is the same `PlannedReminder[]` the current notification code consumes. |
| Review queue | `src/core/labs/queue.ts` | A session is the 7 weakest points, with a finish line and a tone-only summary (the UI supplies translated text). |
| Insights | `src/core/labs/insights.ts` | Gentle rhythm (rest tokens instead of a streak you can lose), hours when reminders get ignored (suggests quiet hours), per-point advice: reword, gentler, graduate. |
| Voice script | `src/core/labs/voice.ts` | Builds a hands-free spoken review: question, pause, answer. Skips private points entirely. Capped at 5 points. |
| App-lock policy | `src/core/labs/lock.ts` | Pure timeout rules and "lock on means notification text hidden". |
| Sky layout | `src/core/labs/sky.ts` | Stable star positions on a golden-angle spiral: a new point lands at the edge, old stars never move. |
| Storage | `src/db/memory.ts`, migration 3 | One `point_memory` table, bound parameters only. |
| Screen | `src/ui/labs/MemorySky.tsx`, `SkyScreen.tsx` | Static view, at most 60 Views, no timers. Opened from Settings, Labs. |
| Wiring | `review.ts`, `reminders.ts`, `ReviewScreen`, `SettingsScreen`, `App.tsx` | Labs switch (off by default); Remembered / Again soon buttons in Review now; every answer logged to `review_log`; opted-in Long-term points planned adaptively and missed reminders recorded as dismissed on app open. |
| Concept page | `concept/` | `node scripts/build-concept.mjs` rebuilds it from the real code. |

## What is only proposed

See [DESIGN.md](DESIGN.md) for rationale, costs and the order I would build things: routine anchors, lock-screen widget, encrypted export, "why this reminder" explainer, and accessibility work.

## Recommendations, in order

1. **Ship the review log and the two answer buttons first** (already on your list). Everything adaptive depends on those two taps.
2. **Adaptive gap as an opt-in per point**, starting with Long-term points, where fixed hourly repeats make least sense. Smallest change with the biggest drop in notifications.
3. **Memory Sky as the Today screen.** It turns the forgetting curve into something you can see, which is the one thing a plain list cannot show.
4. **Suggestion cards** (quiet hours, reword, move to Long-term). Cheap, local, and respectful because they only ask.
5. App lock, then encrypted export, once a development build exists.

## Not tested

Nothing here has run on a phone; it type-checks, the unit tests pass and the Android bundle builds. Battery and memory were not measured. Hindi and Gujarati strings are drafts. The adaptive constants (ease steps, 0.4 shrink, 10-minute retry, caps) are reasonable starting points, not tuned on real use.
