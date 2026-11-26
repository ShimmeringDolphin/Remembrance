// The first-run tips on Home. A few short cards, one at a time, each shown once, each pointing at one control.
// Pure: what has been seen is one short string kept by the app; this decides which tip is next.

/** In the order they are offered. */
export const TIP_IDS = ['awake', 'latest', 'listen', 'settings'] as const;
export type TipId = (typeof TIP_IDS)[number];

/** What has been seen: tips done one by one, or all of them switched off with "Skip tips". */
export interface TipState {
  off: boolean;
  seen: TipId[];
}

export const NO_TIPS_SEEN: TipState = { off: false, seen: [] };

/** Reads the stored string ("off" or "awake,latest"); anything unreadable counts as nothing seen. */
export function parseTips(stored: string | null): TipState {
  if (stored === 'off') return { off: true, seen: [] };
  if (!stored) return NO_TIPS_SEEN;
  const seen = stored.split(',').filter((id): id is TipId => (TIP_IDS as readonly string[]).includes(id));
  return { off: false, seen };
}

export const tipsToString = (s: TipState): string => (s.off ? 'off' : s.seen.join(','));

/** The tip to show now: the first one not seen whose control is on screen. Null when none or switched off. */
export function nextTip(state: TipState, visible: readonly TipId[]): TipId | null {
  if (state.off) return null;
  return TIP_IDS.find((id) => !state.seen.includes(id) && visible.includes(id)) ?? null;
}

export const markSeen = (s: TipState, id: TipId): TipState => (s.seen.includes(id) ? s : { off: s.off, seen: [...s.seen, id] });
export const skipAll = (): TipState => ({ off: true, seen: [] });
