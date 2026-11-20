# YaadOM: product philosophy

Agreed with the owner on 2026-11-20. `docs/SPEC.md` says how the app behaves; this file says why, and is the test every feature has to pass.

## Purpose

**YaadOM puts your own words in front of you at the right moments, with no effort from you, and stays welcome enough that you never mute it.**

## Who it is for

1. **The passive user (current focus).** Writes a few points and wants to see them again and again. Never taps, never opens Settings, never plans. Success is familiarity through frequent exposure.
2. **The proactive user (later).** Wants to test their recall and is happy to tap answers. Success is remembering on demand.

Exposure is the goal for everyone. Recall is an extra for the second group.

## Principles

| # | Principle | Status |
| --- | --- | --- |
| 1 | **Zero-effort path first.** Write a point and it starts appearing. Defaults are applied at setup; nothing is asked before the first point. | Agreed |
| 2 | **The reminder is complete on its own.** Reading it counts as success; a tap is never needed. A tap-based mode for proactive users may come later. | Agreed |
| 3 | **Protect goodwill.** Calm, limited interruptions; never nag. | Agreed |
| 4 | **Keep it fresh.** Vary order and timing so a point does not turn into wallpaper. | Agreed, strongly |
| 5 | **Show up where people already look:** notifications, later lock-screen widgets and voice. | Agreed |
| 6 | **Make adding cheap** (for example, paste several lines to make several points). | Debatable: test and verify first |
| 7 | **Smart features are optional** and fall back to plain repetition when the user gives no signal. Never reduce repetition unless asked. | Agreed |

## The biggest risk

People uninstall when the app feels like a chore or a checklist, even for one point. So: no task language ("review", "due", "overdue", backlogs, red badges), nothing is ever late, and the first screen is a single box. After a while, the app should become quietly interesting to keep (see "Your sky").

## The passive user's journey

1. **Install and open.** One box: "What do you want to keep in mind?", with a rotating example. Save.
2. **Right after the first save.** One sentence explains that YaadOM shows points through the day, and asks for notification permission.
3. **The day.** Reminders arrive inside the active hours (default 7 AM to 10 PM, hourly). Each one shows the points themselves; a different point leads each time and the minute varies a little.
4. **Days later.** The home screen offers "Your sky": every point is a star that grows with each time it has appeared. Nothing to do, nothing to lose.
5. **At 15 points in a category.** A friendly note suggests archiving one or moving it to Long-term. No error.

## Not for now

Point sharing (possibly premium), tap-based recall mode, adaptive gaps, voice, app lock and widgets. Each must pass the principles above before it is built.
