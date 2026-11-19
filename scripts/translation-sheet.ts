// Writes a review sheet for native speakers: node scripts/translation-sheet.ts > sheet.md
import { getStrings } from '../src/i18n/strings.ts';

const en = getStrings('en');
const hi = getStrings('hi');
const gu = getStrings('gu');
const keys = Object.keys(en) as (keyof typeof en)[];
const first = keys.indexOf('remembered');
console.log('# Translation review: new Labs, lock and voice strings\n');
console.log('Please check meaning, tone and natural wording. Placeholders like {n} and {range} must stay unchanged.\n');
console.log('| Key | English | Hindi | Gujarati | OK? / Fix |\n| --- | --- | --- | --- | --- |');
for (const k of keys.slice(first)) console.log(`| ${k} | ${en[k]} | ${hi[k]} | ${gu[k]} | |`);
