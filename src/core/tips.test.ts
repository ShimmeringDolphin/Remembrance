import assert from 'node:assert/strict';
import test from 'node:test';

import { markSeen, nextTip, NO_TIPS_SEEN, parseTips, skipAll, tipsToString, TIP_IDS } from './tips.ts';

test('tips come one at a time in order, each once', () => {
  let s = NO_TIPS_SEEN;
  const seenOrder: string[] = [];
  for (let i = 0; i < 6; i++) {
    const t = nextTip(s, TIP_IDS);
    if (!t) break;
    seenOrder.push(t);
    s = markSeen(s, t);
  }
  assert.deepEqual(seenOrder, ['settings', 'awake', 'latest', 'listen']);
  assert.equal(nextTip(s, TIP_IDS), null);
});

test('a tip whose control is not on screen waits, and the next visible one is shown', () => {
  assert.equal(nextTip(NO_TIPS_SEEN, ['awake', 'listen']), 'awake');
  assert.equal(nextTip(markSeen(NO_TIPS_SEEN, 'awake'), ['listen']), 'listen');
  // Once the latest-reminder button appears, its tip is still offered.
  const s = markSeen(markSeen(markSeen(NO_TIPS_SEEN, 'awake'), 'listen'), 'settings');
  assert.equal(nextTip(s, ['settings', 'awake', 'listen']), null);
  assert.equal(nextTip(s, TIP_IDS), 'latest');
});

test('skip switches every tip off, and the stored string round-trips', () => {
  assert.equal(nextTip(skipAll(), TIP_IDS), null);
  assert.equal(tipsToString(skipAll()), 'off');
  assert.deepEqual(parseTips('off'), skipAll());
  assert.deepEqual(parseTips('awake,latest').seen, ['awake', 'latest']);
  assert.deepEqual(parseTips(tipsToString(markSeen(NO_TIPS_SEEN, 'listen'))), markSeen(NO_TIPS_SEEN, 'listen'));
  // Junk is ignored; nothing stored means nothing seen.
  assert.deepEqual(parseTips('awake,bogus,,'), markSeen(NO_TIPS_SEEN, 'awake'));
  assert.deepEqual(parseTips(null), NO_TIPS_SEEN);
  assert.deepEqual(parseTips(''), NO_TIPS_SEEN);
  assert.equal(nextTip(parseTips('off'), TIP_IDS), null);
});

test('the Settings tip at the top comes first and is not held up by the Listen tip at the bottom', () => {
  assert.equal(nextTip(NO_TIPS_SEEN, ['settings', 'awake', 'listen']), 'settings');
  assert.equal(nextTip(markSeen(NO_TIPS_SEEN, 'settings'), ['settings', 'awake', 'listen']), 'awake');
});
