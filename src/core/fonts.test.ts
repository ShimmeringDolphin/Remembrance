import assert from 'node:assert/strict';
import test from 'node:test';

import { familyFor, roleOfWeight } from '../theme/fonts.ts';

test('the style weight picks the font role', () => {
  assert.equal(roleOfWeight('700'), 'heading');
  assert.equal(roleOfWeight('bold'), 'heading');
  assert.equal(roleOfWeight('800'), 'heading');
  assert.equal(roleOfWeight('600'), 'semibold');
  assert.equal(roleOfWeight('500'), 'body');
  assert.equal(roleOfWeight('normal'), 'body');
  assert.equal(roleOfWeight(undefined), 'body');
  assert.equal(roleOfWeight(700), 'heading');
});

test('Hindi and English share families; Gujarati has its own', () => {
  assert.equal(familyFor('en', '700'), 'Baloo2_700Bold');
  assert.equal(familyFor('hi', undefined), 'Hind_400Regular');
  assert.equal(familyFor('gu', '700'), 'BalooBhai2_700Bold');
  assert.equal(familyFor('gu', '600'), 'HindVadodara_600SemiBold');
});

import { extraSetsNeeded, fontRuns } from '../theme/fonts.ts';

test('a Hindi line in a Gujarati app is drawn in the Latin/Devanagari set, the English words in the Gujarati set', () => {
  const runs = fontRuns('Drink पानी daily', 'gu');
  assert.deepEqual(runs.map((r) => r.set), ['gu', 'lat', 'gu']);
  assert.equal(runs.map((r) => r.text).join(''), 'Drink पानी daily');
});

test('a Gujarati line in an English app uses the Gujarati set', () => {
  assert.deepEqual(fontRuns('પાણી પીઓ', 'en').map((r) => r.set), ['gu']);
  assert.deepEqual(fontRuns('12 …', 'hi'), [{ text: '12 …', set: 'lat' }]);
});

test('only the missing set is asked for', () => {
  assert.deepEqual(extraSetsNeeded(['hello', 'पानी'], 'en'), []);
  assert.deepEqual(extraSetsNeeded(['hello', 'પાણી'], 'hi'), ['gu']);
  assert.deepEqual(extraSetsNeeded(['hello', 'पानी'], 'gu'), ['lat']);
  assert.deepEqual(extraSetsNeeded(['પાણી'], 'gu'), []);
});
