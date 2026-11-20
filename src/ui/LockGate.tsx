import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { initialLockState, isLocked, onAuthenticated, onBackground, onForeground } from '../core/labs/lock';
import type { Settings } from '../core/types';
import { authenticate } from '../lock/auth';
import type { Strings } from '../i18n/strings';
import type { calmStudy } from '../theme/calmStudy';

type Colors = (typeof calmStudy)['light'] | (typeof calmStudy)['dark'];

interface Props {
  lock: Settings['appLock'];
  /** Wait for saved settings before deciding, so the lock cannot be skipped during loading. */
  settingsLoaded: boolean;
  /** Increases when the user turns the lock on in Settings after authenticating, so it does not lock them out at once. */
  unlockSignal: number;
  t: Strings;
  colors: Colors;
  children: ReactNode;
}

/**
 * Covers the app with a lock screen when the app lock is on and the user has not authenticated,
 * or has been away longer than the timeout. One AppState listener, no timers. The cover also hides
 * the app contents while it is in the background or inactive, so the app switcher shows no points.
 */
export function LockGate({ lock, settingsLoaded, unlockSignal, t, colors, children }: Props) {
  const [state, setState] = useState(initialLockState);
  const [appState, setAppState] = useState(AppState.currentState);
  const authenticating = useRef(false);
  const lockRef = useRef(lock);
  lockRef.current = lock;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setAppState(next);
      // Only a real trip to the background counts. The system prompt itself makes the app inactive.
      if (next === 'background') setState((s) => onBackground(s, Date.now()));
      else if (next === 'active' && !authenticating.current) setState((s) => onForeground(s, Date.now(), lockRef.current));
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (unlockSignal > 0) setState(onAuthenticated());
  }, [unlockSignal]);

  const unlock = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    try {
      if (await authenticate(t.unlockPrompt)) setState(onAuthenticated());
    } finally {
      authenticating.current = false;
    }
  }, [t.unlockPrompt]);

  const locked = lock.enabled && (!settingsLoaded || isLocked(state, lock));
  const shielded = lock.enabled && (locked || appState !== 'active');

  // Ask as soon as the cover appears, once settings are known.
  useEffect(() => {
    if (lock.enabled && settingsLoaded && isLocked(state, lock) && appState === 'active') void unlock();
  }, [lock, settingsLoaded, state, appState, unlock]);

  return (
    <View style={styles.fill}>
      <View style={styles.fill} accessibilityElementsHidden={shielded} importantForAccessibility={shielded ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {shielded ? (
        <View style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: colors.background }]}>
          {locked ? (
            <>
              <Text style={[styles.title, { color: colors.text }]}>{t.lockedTitle}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.unlock}
                onPress={() => void unlock()}
                style={[styles.button, { backgroundColor: colors.accent }]}
              >
                <Text style={{ color: colors.onAccent, fontWeight: '600', fontSize: 16 }}>{t.unlock}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cover: { alignItems: 'center', justifyContent: 'center', gap: 20 },
  title: { fontSize: 22, fontWeight: '600' },
  button: { minHeight: 48, paddingHorizontal: 28, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
