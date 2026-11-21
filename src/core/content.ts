// What a notification says. It is complete on its own: reading it is enough.
import type { Category, Point } from './types';

export interface ContentText {
  title: string;
  /** One hidden point. */
  privateOne: string;
  /** Several hidden points. Contains "{n}". */
  privateMany: string;
  /** Extra line when some points in the reminder are private. Contains "{n}". */
  privateExtra: string;
}

export interface Content {
  title: string;
  body: string;
  /** Long-term when the reminder holds a Long-term point, so its colour can differ. */
  category: Category;
}

/** Private mode and private points never show their words; missing points count as private. */
export function buildContent(pointIds: readonly string[], byId: ReadonlyMap<string, Point>, privateMode: boolean, text: ContentText): Content {
  const shown: string[] = [];
  let category: Category = 'daily';
  for (const id of pointIds) {
    const p = byId.get(id);
    if (p?.category === 'long_term') category = 'long_term';
    if (p && !p.private && !privateMode) shown.push(p.text);
  }
  const hidden = pointIds.length - shown.length;
  if (shown.length === 0) {
    return { title: text.title, body: hidden === 1 ? text.privateOne : text.privateMany.replace('{n}', String(hidden)), category };
  }
  if (hidden > 0) shown.push(text.privateExtra.replace('{n}', String(hidden)));
  return { title: text.title, body: shown.join('\n'), category };
}
