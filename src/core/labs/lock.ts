// Experimental: pure app-lock policy. The UI feeds it events and shows the lock screen when it says so.
import type { Settings } from '../types';

export interface LockState {
  /** Epoch ms when the app last went to the background, or null while it is in the foreground. */
  backgroundedAt: number | null;
  /** Whether the user has passed authentication in this app process. */
  unlocked: boolean;
}

export const initialLockState = (): LockState => ({ backgroundedAt: null, unlocked: false });

export const onBackground = (s: LockState, now: number): LockState =>
  s.backgroundedAt === null ? { ...s, backgroundedAt: now } : s;

export const onAuthenticated = (): LockState => ({ backgroundedAt: null, unlocked: true });

/** Coming back to the foreground: stays unlocked only if away for no longer than the timeout. */
export function onForeground(s: LockState, now: number, lock: Settings['appLock']): LockState {
  const away = s.backgroundedAt === null ? 0 : now - s.backgroundedAt;
  const stillOpen = s.unlocked && away <= lock.timeoutSeconds * 1000;
  return { backgroundedAt: null, unlocked: stillOpen };
}

export const isLocked = (s: LockState, lock: Settings['appLock']): boolean => lock.enabled && !s.unlocked;

/** With the lock on, notification text stays hidden unless the user chose otherwise (`reveal`). */
export const effectivePrivate = (settings: Settings, reveal = false): boolean =>
  settings.privateNotifications || (settings.appLock.enabled && !reveal);
