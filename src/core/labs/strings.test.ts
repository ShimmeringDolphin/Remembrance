import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getStrings } from '../../i18n/strings.ts';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('every string exists in all languages with the same placeholders and none is empty', () => {
  const en = getStrings('en');
  for (const lang of ['hi', 'gu'] as const) {
    const other = getStrings(lang);
    assert.deepEqual(Object.keys(other).sort(), Object.keys(en).sort(), `${lang} keys differ`);
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      assert.ok(other[key].trim().length > 0, `${lang}.${key} is empty`);
      assert.equal(placeholders(other[key]), placeholders(en[key]), `${lang}.${key} placeholders differ`);
    }
  }
});
