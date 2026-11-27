import assert from 'node:assert/strict';
import test from 'node:test';

import { dark, light, type Theme } from '../theme/calmStudy.ts';
import { contrast } from './contrast.ts';

// Every pair that carries text must reach 4.5:1 (the usual minimum for body text).
const textPairs = (t: Theme): [string, string, string][] => [
  ['text on background', t.text, t.background],
  ['text on surface', t.text, t.surface],
  ['muted on background', t.muted, t.background],
  ['muted on surface', t.muted, t.surface],
  ['muted on chip', t.muted, t.chip],
  ['text on chip', t.text, t.chip],
  ['accent on background', t.accent, t.background],
  ['accent on surface', t.accent, t.surface],
  ['onAccent on accent', t.onAccent, t.accent],
  ['dailyInk on background', t.dailyInk, t.background],
  ['dailyInk on surface', t.dailyInk, t.surface],
  ['dailyInk on dailySoft', t.dailyInk, t.dailySoft],
  ['longInk on background', t.longInk, t.background],
  ['longInk on surface', t.longInk, t.surface],
  ['longInk on longTermSoft', t.longInk, t.longTermSoft],
  ['onButton on button', t.onButton, t.button],
  ['onDaily on daily', t.onDaily, t.daily],
  ['onLong on longTerm', t.onLong, t.longTerm],
  ['cardText on dailySoft', t.cardText, t.dailySoft],
  ['cardText on longTermSoft', t.cardText, t.longTermSoft],
  ['skyText on sky', t.skyText, t.sky],
  ['skyText on skyCard', t.skyText, t.skyCard],
  ['star on sky', t.star, t.sky],
];

for (const [name, theme] of [['light', light], ['dark', dark]] as const) {
  test(`${name} theme: every text pair reaches 4.5:1`, () => {
    const failed = textPairs(theme)
      .map(([label, fg, bg]) => ({ label, ratio: contrast(fg, bg) }))
      .filter((p) => p.ratio < 4.5)
      .map((p) => `${p.label} ${p.ratio.toFixed(2)}`);
    assert.deepEqual(failed, []);
  });
}

test('contrast of black on white is 21', () => {
  assert.equal(Math.round(contrast('#000000', '#FFFFFF')), 21);
});
