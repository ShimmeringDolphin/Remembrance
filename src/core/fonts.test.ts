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
