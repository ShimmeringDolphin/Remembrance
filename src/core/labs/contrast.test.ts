import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calmStudy } from '../../theme/calmStudy.ts';
import { contrastRatio } from './contrast.ts';

test('contrast ratio matches the known WCAG extremes', () => {
  assert.ok(Math.abs(contrastRatio('#000000', '#FFFFFF') - 21) < 0.01);
  assert.ok(Math.abs(contrastRatio('#777777', '#777777') - 1) < 0.01);
});

test('Calm Study text colours reach WCAG AA (4.5:1) on the background in both themes', () => {
  for (const mode of ['light', 'dark'] as const) {
    const c = calmStudy[mode];
    for (const [name, fg] of [['text', c.text], ['mutedText', c.mutedText], ['accent', c.accent]] as const) {
      const ratio = contrastRatio(fg, c.background);
      assert.ok(ratio >= 4.5, `${mode} ${name} on background is ${ratio.toFixed(2)}`);
    }
    const onAccent = contrastRatio(c.onAccent, c.accent);
    assert.ok(onAccent >= 4.5, `${mode} onAccent on accent is ${onAccent.toFixed(2)}`);
  }
});
