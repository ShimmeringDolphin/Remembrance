// Sanity simulation for the adaptive gap model (run: node scripts/simulate-adaptive.ts).
// A simulated user has a hidden memory that does NOT follow the model's own curve: recall chance is
// 0.9^(gap / trueStability), and trueStability grows by `growth` after a success and halves after a
// failure. Compares reminders sent in 30 days against a fixed 16-a-day grid (hourly, 07:00-22:00).
import { applyAnswer, newMemory } from '../src/core/labs/memory.ts';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

const DAYS = 30;
const FIXED_PER_DAY = 16;

function run(growth: number, startStabilityMin: number, seed: number) {
  const rand = rng(seed);
  let trueS = startStabilityMin;
  let mem = newMemory('p', new Date(0), 240);
  let now = 0;
  let reminders = 0;
  let lapses = 0;
  const end = DAYS * 1440;
  while (true) {
    const due = Date.parse(mem.nextDueAt) / 60000;
    now = due;
    if (now > end) break;
    reminders++;
    const gap = mem.lastReviewedAt ? now - Date.parse(mem.lastReviewedAt) / 60000 : 240;
    const recalled = rand() < Math.pow(0.9, gap / trueS);
    if (recalled) trueS *= growth;
    else {
      trueS = Math.max(60, trueS / 2);
      lapses++;
    }
    mem = applyAnswer(mem, recalled ? 'remembered' : 'again_soon', 'long_term', new Date(now * 60000));
  }
  return { reminders, lapses, finalGapDays: +(mem.intervalMinutes / 1440).toFixed(1) };
}

console.log(`Fixed grid: ${FIXED_PER_DAY * DAYS} reminders per point in ${DAYS} days.`);
console.log('growth  startStability  reminders  lapses  missRate  finalGap(days)   (mean of 20 seeds)');
for (const growth of [1.3, 2, 3]) {
  for (const start of [120, 1440]) {
    const rs = Array.from({ length: 20 }, (_, i) => run(growth, start, i + 1));
    const mean = (f: (r: (typeof rs)[number]) => number) => +(rs.reduce((a, r) => a + f(r), 0) / rs.length).toFixed(1);
    console.log(`${growth}\t${start}\t\t${mean((r) => r.reminders)}\t   ${mean((r) => r.lapses)}\t   ${(mean((r) => r.lapses) / mean((r) => r.reminders)).toFixed(2)}\t   ${mean((r) => r.finalGapDays)}`);
  }
}
