/** Most points kept in one category (Daily or Long-term), not counting put-away ones. */
export const MAX_PER_CATEGORY = 15;
/** Longest point, in characters: one glanceable line. */
export const MAX_TEXT_LENGTH = 200;

export const canAdd = (countInCategory: number): boolean => countInCategory < MAX_PER_CATEGORY;

/** Trims and shortens text; returns null when nothing is left. */
export function cleanText(raw: string): string | null {
  const t = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH);
  return t.length > 0 ? t : null;
}
