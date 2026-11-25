import assert from 'node:assert/strict';
import test from 'node:test';

import { languageOf } from './script.ts';

test('languageOf picks the voice from the script of the point', () => {
  assert.equal(languageOf('Drink water', 'hi'), 'en');
  assert.equal(languageOf('पानी पीना है', 'en'), 'hi');
  assert.equal(languageOf('પાણી પીવું છે', 'en'), 'gu');
  // Mixed: the script with the most letters wins.
  assert.equal(languageOf('पानी पीना है ok', 'en'), 'hi');
  assert.equal(languageOf('Take medicine दवा', 'hi'), 'en');
});

test('languageOf falls back to the app language when there are no letters or the scripts tie', () => {
  assert.equal(languageOf('123 !?', 'gu'), 'gu');
  assert.equal(languageOf('', 'hi'), 'hi');
  assert.equal(languageOf('ab पा', 'gu'), 'gu');
});
