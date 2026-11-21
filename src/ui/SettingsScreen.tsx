import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_QUIET_RANGES, addQuietRange, removeQuietRange, shiftQuietRange } from '../core/quiet';
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
  onClose: () => void;
}

export function SettingsScreen({ visible, settings, t, colors, onChange, onClose }: Props) {
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

  const stepper = (label: string, value: string, onShift: (deltaMinutes: number) => void) => (
    <View style={styles.stepper}>
      <Text style={[styles.stepperLabel, { color: colors.mutedText }]}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} -30`} onPress={() => onShift(-30)} style={styles.stepButton}>
        <Text style={{ color: colors.accent, fontSize: 20 }}>−</Text>
      </Pressable>
      <Text style={[styles.time, { color: colors.text }]}>{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} +30`} onPress={() => onShift(30)} style={styles.stepButton}>
        <Text style={{ color: colors.accent, fontSize: 20 }}>+</Text>
      </Pressable>
    </View>
  );

  const shiftActive = (field: 'start' | 'end', delta: number) =>
    onChange({ ...settings, activeHours: { ...settings.activeHours, [field]: shiftTime(settings.activeHours[field], delta) } });

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
              {stepper(t.from, settings.activeHours.start, (d) => shiftActive('start', d))}
              {stepper(t.to, settings.activeHours.end, (d) => shiftActive('end', d))}
            </View>
          ) : null}

          <Text style={[styles.label, { color: colors.mutedText }]}>{t.quietTitle}</Text>
          {settings.quietHours.map((range, i) => (
            <View key={i} style={styles.quietRange}>
              {stepper(t.from, range.start, (d) => onChange({ ...settings, quietHours: shiftQuietRange(settings.quietHours, i, 'start', d) }))}
              {stepper(t.to, range.end, (d) => onChange({ ...settings, quietHours: shiftQuietRange(settings.quietHours, i, 'end', d) }))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.removeQuiet}
                onPress={() => onChange({ ...settings, quietHours: removeQuietRange(settings.quietHours, i) })}
                style={styles.removeQuiet}
              >
                <Text style={{ color: colors.mutedText }}>{t.removeQuiet}</Text>
              </Pressable>
            </View>
          ))}
          {settings.quietHours.length < MAX_QUIET_RANGES ? (
            <View style={styles.row}>
              {chip(t.addQuiet, false, () => onChange({ ...settings, quietHours: addQuietRange(settings.quietHours) }), 'q-add')}
            </View>
          ) : null}
          <Text style={[styles.note, { color: colors.mutedText }]}>{t.quietNote}</Text>

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
  quietRange: { marginBottom: 12, gap: 8 },
  removeQuiet: { alignSelf: 'flex-start', paddingVertical: 8 },
  note: { marginTop: 8, fontSize: 14 },
  hours: { marginTop: 12, gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperLabel: { width: 56 },
  stepButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  time: { fontSize: 20, fontVariant: ['tabular-nums'], minWidth: 64, textAlign: 'center' },
  switchRow: { marginTop: 28, justifyContent: 'space-between', flexWrap: 'nowrap' },
  switchLabel: { flex: 1, fontSize: 16 },
  close: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
});
