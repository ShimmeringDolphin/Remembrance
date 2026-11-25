import assert from 'node:assert/strict';
import test from 'node:test';

import { scriptRuns } from './script.ts';

test('scriptRuns splits a mixed line into runs, each in its own voice', () => {
  assert.deepEqual(scriptRuns('You are a Soul. अपने को आत्मा स्वरूप में स्थित करो। આત્મા છું.', 'en'), [
    { text: 'You are a Soul.', language: 'en' },
    { text: 'अपने को आत्मा स्वरूप में स्थित करो।', language: 'hi' },
    { text: 'આત્મા છું.', language: 'gu' },
  ]);
});

test('scriptRuns keeps digits and punctuation with their neighbours and handles plain text', () => {
  assert.deepEqual(scriptRuns('7 पानी', 'en'), [{ text: '7 पानी', language: 'hi' }]);
  assert.deepEqual(scriptRuns('Drink water', 'hi'), [{ text: 'Drink water', language: 'en' }]);
  assert.deepEqual(scriptRuns('123 !?', 'gu'), [{ text: '123 !?', language: 'gu' }]);
  assert.deepEqual(scriptRuns('   ', 'en'), []);
});
