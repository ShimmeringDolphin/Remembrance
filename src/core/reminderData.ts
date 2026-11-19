/** Reads the point ids out of a tapped notification's data. The data is untrusted, so check it. */
export function pointIdsFromData(data: unknown): string[] {
  if (typeof data !== 'object' || data === null) return [];
  const ids = (data as { pointIds?: unknown }).pointIds;
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === 'string').slice(0, 50);
}
