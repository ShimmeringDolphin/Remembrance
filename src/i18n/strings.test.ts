/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fill, STRINGS } from './strings.ts';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const TASK_WORDS = /\b(due|overdue|streak|missed|goal|complete|failed)\b/i;

test('every language has the same keys and placeholders', () => {
  const keys = Object.keys(STRINGS.en).sort();
  for (const lang of ['hi', 'gu'] as const) {
    assert.deepEqual(Object.keys(STRINGS[lang]).sort(), keys, lang);
    for (const k of keys) {
      const key = k as keyof typeof STRINGS.en;
      assert.deepEqual(placeholders(STRINGS[lang][key]), placeholders(STRINGS.en[key]), `${lang}.${k}`);
      assert.ok(STRINGS[lang][key].trim().length > 0, `${lang}.${k} is empty`);
    }
  }
});

test('English text never uses task words', () => {
  for (const [k, v] of Object.entries(STRINGS.en)) assert.ok(!TASK_WORDS.test(v), `en.${k}: ${v}`);
});

test('fill replaces known placeholders and leaves others', () => {
  assert.equal(fill('{n} of {m}', { n: 3 }), '3 of {m}');
});
