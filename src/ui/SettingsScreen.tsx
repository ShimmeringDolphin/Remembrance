import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authenticate, canUseLock } from '../lock/auth';
import { shiftTime } from '../core/time';
import type { ActiveMode, Language, NotificationStyle, Settings } from '../core/types';
import { LANGUAGE_NAMES, type Strings } from '../i18n/strings';
import type { calmStudy } from '../theme/calmStudy';

type Colors = (typeof calmStudy)['light'] | (typeof calmStudy)['dark'];

const FREQUENCIES = [15, 30, 60, 120, 180];

interface Props {
  visible: boolean;
  settings: Settings;
  t: Strings;
  colors: Colors;
  onChange: (next: Settings) => void;
  onOpenSky: () => void;
  /** Called after the lock was turned on and the user authenticated. */
  onLockEnabled: () => void;
  onClose: () => void;
}

export function SettingsScreen({ visible, settings, t, colors, onChange, onOpenSky, onLockEnabled, onClose }: Props) {
  const [lockUnavailable, setLockUnavailable] = useState(false);
  const insets = useSafeAreaInsets();
  const everyMinutes = settings.defaultFrequency.mode === 'interval' ? settings.defaultFrequency.everyMinutes : 60;

  const chip = (label: string, selected: boolean, onPress: () => void, key: string) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: colors.accent, backgroundColor: selected ? colors.accent : 'transparent' }]}
    >
      <Text style={{ color: selected ? colors.onAccent : colors.accent }}>{label}</Text>
    </Pressable>
  );

  const stepper = (label: string, value: string, field: 'start' | 'end') => (
    <View style={styles.stepper}>
      <Text style={[styles.stepperLabel, { color: colors.mutedText }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} -30`}
        onPress={() => onChange({ ...settings, activeHours: { ...settings.activeHours, [field]: shiftTime(value, -30) } })}
        style={styles.stepButton}
      >
        <Text style={{ color: colors.accent, fontSize: 20 }}>−</Text>
      </Pressable>
      <Text style={[styles.time, { color: colors.text }]}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} +30`}
        onPress={() => onChange({ ...settings, activeHours: { ...settings.activeHours, [field]: shiftTime(value, 30) } })}
        style={styles.stepButton}
      >
        <Text style={{ color: colors.accent, fontSize: 20 }}>+</Text>
      </Pressable>
    </View>
  );

  const toggleLock = async (enabled: boolean) => {
    if (!enabled) {
      setLockUnavailable(false);
      onChange({ ...settings, appLock: { ...settings.appLock, enabled: false } });
      return;
    }
    // Prove it works before turning it on, so a user can never lock themselves out.
    if (!(await canUseLock())) {
      setLockUnavailable(true);
      return;
    }
    if (!(await authenticate(t.unlockPrompt))) return;
    setLockUnavailable(false);
    onChange({ ...settings, appLock: { ...settings.appLock, enabled: true } });
    onLockEnabled();
  };

  const setMode = (activeMode: ActiveMode) => onChange({ ...settings, activeMode });
  const setStyle = (notificationStyle: NotificationStyle) => onChange({ ...settings, notificationStyle });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <Text style={[styles.heading, { color: colors.text }]}>{t.settings}</Text>

          <Text style={[styles.label, { color: colors.mutedText }]}>{t.languageTitle}</Text>
          <View style={styles.row}>
            {(Object.keys(LANGUAGE_NAMES) as Language[]).map((code) =>
              chip(LANGUAGE_NAMES[code], settings.appLanguage === code, () => onChange({ ...settings, appLanguage: code }), `l-${code}`),
            )}
          </View>

          <Text style={[styles.label, { color: colors.mutedText }]}>{t.frequencyTitle}</Text>
          <View style={styles.row}>
            {FREQUENCIES.map((n) =>
              chip(t.minutesShort.replace('{n}', String(n)), everyMinutes === n, () => onChange({ ...settings, defaultFrequency: { mode: 'interval', everyMinutes: n } }), `f${n}`),
            )}
          </View>

          <Text style={[styles.label, { color: colors.mutedText }]}>{t.activeHours}</Text>
          <View style={styles.row}>
            {chip(t.modeHours, settings.activeMode === 'hours', () => setMode('hours'), 'm1')}
            {chip(t.modeButton, settings.activeMode === 'button_only', () => setMode('button_only'), 'm2')}
          </View>
          {settings.activeMode === 'hours' ? (
            <View style={styles.hours}>
              {stepper(t.from, settings.activeHours.start, 'start')}
              {stepper(t.to, settings.activeHours.end, 'end')}
            </View>
          ) : null}

          <Text style={[styles.label, { color: colors.mutedText }]}>{t.styleTitle}</Text>
          <View style={styles.row}>
            {chip(t.styleGrouped, settings.notificationStyle === 'grouped', () => setStyle('grouped'), 's1')}
            {chip(t.styleIndividual, settings.notificationStyle === 'individual', () => setStyle('individual'), 's2')}
          </View>

          <View style={[styles.row, styles.switchRow]}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>{t.privateTitle}</Text>
            <Switch
              value={settings.privateNotifications}
              onValueChange={(privateNotifications) => onChange({ ...settings, privateNotifications })}
              trackColor={{ true: colors.accent }}
            />
          </View>

          <Text style={[styles.label, { color: colors.mutedText }]}>{t.lockTitle}</Text>
          <View style={[styles.row, { flexWrap: 'nowrap', justifyContent: 'space-between' }]}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>{t.lockEnable}</Text>
            <Switch
              accessibilityLabel={t.lockEnable}
              value={settings.appLock.enabled}
              onValueChange={(v) => void toggleLock(v)}
              trackColor={{ true: colors.accent }}
            />
          </View>
          <Text style={[styles.hint, { color: colors.mutedText }]}>{lockUnavailable ? t.lockUnavailable : t.lockHint}</Text>
          {settings.appLock.enabled ? (
            <>
              <Text style={[styles.label, { color: colors.mutedText }]}>{t.lockTimeoutTitle}</Text>
              <View style={styles.row}>
                {[0, 60, 300].map((sec) =>
                  chip(
                    sec === 0 ? t.lockImmediately : t.lockAfterMin.replace('{n}', String(sec / 60)),
                    settings.appLock.timeoutSeconds === sec,
                    () => onChange({ ...settings, appLock: { ...settings.appLock, timeoutSeconds: sec } }),
                    `lt${sec}`,
                  ),
                )}
              </View>
            </>
          ) : null}

          <Text style={[styles.label, { color: colors.mutedText }]}>{t.voiceTitle}</Text>
          <View style={[styles.row, { flexWrap: 'nowrap', justifyContent: 'space-between' }]}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>{t.voiceEnable}</Text>
            <Switch
              accessibilityLabel={t.voiceEnable}
              value={settings.delivery.voice}
              onValueChange={(voice) => onChange({ ...settings, delivery: { ...settings.delivery, voice } })}
              trackColor={{ true: colors.accent }}
            />
          </View>
          <Text style={[styles.hint, { color: colors.mutedText }]}>{t.voiceHint}</Text>

          <Text style={[styles.label, { color: colors.mutedText }]}>{t.labsTitle}</Text>
          <View style={[styles.row, { flexWrap: 'nowrap', justifyContent: 'space-between' }]}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>{t.labsAdaptive}</Text>
            <Switch
              accessibilityLabel={t.labsAdaptive}
              value={settings.labs.adaptiveLongTerm}
              onValueChange={(adaptiveLongTerm) => onChange({ ...settings, labs: { ...settings.labs, adaptiveLongTerm } })}
              trackColor={{ true: colors.accent }}
            />
          </View>
          <Text style={[styles.hint, { color: colors.mutedText }]}>{t.labsAdaptiveHint}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t.openSky} onPress={onOpenSky} style={styles.skyLink}>
            <Text style={{ color: colors.accent, fontSize: 16 }}>{t.openSky}</Text>
          </Pressable>
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={[styles.close, { backgroundColor: colors.accent, marginBottom: insets.bottom + 16 }]}
        >
          <Text style={{ color: colors.onAccent, fontWeight: '600' }}>{t.close}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  heading: { fontSize: 22, fontWeight: '600', marginBottom: 8 },
  label: { marginTop: 24, marginBottom: 8, fontSize: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  hours: { marginTop: 12, gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperLabel: { width: 56 },
  stepButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  time: { fontSize: 20, fontVariant: ['tabular-nums'], minWidth: 64, textAlign: 'center' },
  switchRow: { marginTop: 28, justifyContent: 'space-between', flexWrap: 'nowrap' },
  switchLabel: { flex: 1, fontSize: 16 },
  hint: { marginTop: 6, fontSize: 13 },
  skyLink: { marginTop: 8, minHeight: 44, justifyContent: 'center' },
  close: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
});
