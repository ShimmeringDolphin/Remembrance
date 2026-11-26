import assert from 'node:assert/strict';
import test from 'node:test';

import { feedbackMailto } from './feedback.ts';

test('feedback mailto carries the version, system and language, and is a valid link', () => {
  const url = feedbackMailto('a@b.co', { version: '1.0.0', platform: 'android', osVersion: '12', language: 'hi' });
  assert.ok(url.startsWith('mailto:a@b.co?subject='));
  const params = new URLSearchParams(url.split('?')[1]);
  assert.equal(params.get('subject'), 'YaadOM feedback (v1.0.0)');
  const body = params.get('body') ?? '';
  assert.ok(body.includes('App version: 1.0.0') && body.includes('android: 12') && body.includes('Language: hi'));
  assert.ok(!url.includes(' ') && !url.includes('\n'));
});
