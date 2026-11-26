import assert from 'node:assert/strict';
import test from 'node:test';

import { englishWithNeighbour, scriptRuns } from './script.ts';

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

import { VOICE_SAMPLES } from './voiceSamples.ts';

test('every voice sample splits into the languages its text shows, in order', () => {
  const order = (t: string) => scriptRuns(t, 'en').map((r) => r.language).join('');
  const expected = ['enhi', 'hien', 'engu', 'guen', 'higu', 'guhi', 'enhigu', 'guhien', 'hiengu', 'en', 'hi', 'gu'];
  assert.deepEqual(VOICE_SAMPLES.map(order), expected);
});

import { playRuns } from './script.ts';

test('playRuns plays every run of several points in order, waiting for each one', () => {
  const runs = [...scriptRuns('Be calm. शांत रहो।', 'en'), ...scriptRuns('શાંત રહો. Be calm.', 'en')];
  const played: string[] = [];
  let pending: (() => void) | null = null;
  let ended = 0;
  playRuns(runs, (r, done) => { played.push(r.language); pending = done; }, () => true, () => ended++);
  // Nothing moves until the engine says the current part is over.
  assert.deepEqual(played, ['en']);
  for (let k = 0; k < 3; k++) (pending as unknown as () => void)();
  assert.deepEqual(played, ['en', 'hi', 'gu', 'en']);
  (pending as unknown as () => void)();
  assert.equal(ended, 1);
});

test('playRuns goes on after a run that fails or reports twice, and stops when told to', () => {
  const runs = scriptRuns('a शांत b', 'en');
  const played: string[] = [];
  let ended = 0;
  playRuns(runs, (r, done) => { played.push(r.language); done(); done(); }, () => true, () => ended++);
  assert.deepEqual(played, ['en', 'hi', 'en']);
  assert.equal(ended, 1);
  const stopped: string[] = [];
  let live = true;
  playRuns(runs, (r, done) => { stopped.push(r.language); live = false; done(); }, () => live, () => ended++);
  assert.deepEqual(stopped, ['en']);
  assert.equal(ended, 2);
});

import { pickVoice } from './voicePick.ts';

test('pickVoice prefers offline, then Indian voices, and ignores other languages', () => {
  const voices = [
    { identifier: 'hi-in-x-hia-network', name: 'hi-in-x-hia-network', language: 'hi-IN' },
    { identifier: 'hi-in-x-hic-local', name: 'hi-in-x-hic-local', language: 'hi-IN' },
    { identifier: 'en-gb-x-gba-local', name: 'en-gb-x-gba-local', language: 'en-GB' },
    { identifier: 'en-in-x-ene-network', name: 'en-in-x-ene-network', language: 'en-IN' },
    { identifier: 'en-us-x-iom-local', name: 'en-us-x-iom-local', language: 'en-US' },
    { identifier: 'gu-in-x-gua-network', name: 'gu-in-x-gua-network', language: 'gu-IN' },
  ];
  assert.equal(pickVoice(voices, 'hi'), 'hi-in-x-hic-local');
  assert.equal(pickVoice(voices, 'en'), 'en-gb-x-gba-local');
  // Only a network voice exists for Gujarati: it is still used rather than none.
  assert.equal(pickVoice(voices, 'gu'), 'gu-in-x-gua-network');
  assert.equal(pickVoice(voices, 'fr'), undefined);
  assert.equal(pickVoice([], 'hi'), undefined);
});

test('englishWithNeighbour gives English parts to the Indian voice beside them and joins runs', () => {
  const merge = (t: string) => englishWithNeighbour(scriptRuns(t, 'en'));
  assert.deepEqual(merge('Be calm. शांत रहो।'), [{ text: 'Be calm. शांत रहो।', language: 'hi' }]);
  assert.deepEqual(merge('शांत रहो। Be calm.'), [{ text: 'शांत रहो। Be calm.', language: 'hi' }]);
  // The run before wins; Hindi and Gujarati stay apart.
  assert.deepEqual(merge('શાંત રહો. Be calm. शांत रहो।').map((r) => r.language), ['gu', 'hi']);
  assert.deepEqual(merge('Hello. શાંત.'), [{ text: 'Hello. શાંત.', language: 'gu' }]);
});

test('englishWithNeighbour leaves English-only and Indian-only lines alone', () => {
  assert.deepEqual(englishWithNeighbour(scriptRuns('Be calm.', 'en')), [{ text: 'Be calm.', language: 'en' }]);
  assert.deepEqual(englishWithNeighbour(scriptRuns('शांत रहो। શાંત.', 'en')).map((r) => r.language), ['hi', 'gu']);
  assert.deepEqual(englishWithNeighbour([]), []);
});
