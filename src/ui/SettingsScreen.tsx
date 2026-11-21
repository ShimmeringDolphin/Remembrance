import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addQuietRange, MAX_QUIET_HOURS, removeQuietRange, updateQuietRange } from '../core/quietHours';
import { shiftTime } from '../core/time';
import type { ActiveMode, NotificationStyle, Settings } from '../core/types';
import type { Strings } from '../i18n/strings';
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

  /** A time with − and + buttons that move it by 30 minutes. */
  const stepper = (label: string, value: string, onValue: (next: string) => void, key: string) => (
    <View style={styles.stepper} key={key}>
      <Text style={[styles.stepperLabel, { color: colors.mutedText }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} -30`}
        onPress={() => onValue(shiftTime(value, -30))}
        style={styles.stepButton}
      >
        <Text style={{ color: colors.accent, fontSize: 20 }}>−</Text>
      </Pressable>
      <Text style={[styles.time, { color: colors.text }]}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} +30`}
        onPress={() => onValue(shiftTime(value, 30))}
        style={styles.stepButton}
      >
        <Text style={{ color: colors.accent, fontSize: 20 }}>+</Text>
      </Pressable>
    </View>
  );

  const setActive = (field: 'start' | 'end') => (next: string) =>
    onChange({ ...settings, activeHours: { ...settings.activeHours, [field]: next } });
  const setQuiet = (index: number, field: 'start' | 'end') => (next: string) =>
    onChange({
      ...settings,
      quietHours: updateQuietRange(settings.quietHours, index, { ...settings.quietHours[index], [field]: next }),
    });

  const setMode = (activeMode: ActiveMode) => onChange({ ...settings, activeMode });
  const setStyle = (notificationStyle: NotificationStyle) => onChange({ ...settings, notificationStyle });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <Text style={[styles.heading, { color: colors.text }]}>{t.settings}</Text>

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
              {stepper(t.from, settings.activeHours.start, setActive('start'), 'a1')}
              {stepper(t.to, settings.activeHours.end, setActive('end'), 'a2')}
            </View>
          ) : null}

          <Text style={[styles.label, { color: colors.mutedText }]}>{t.quietHours}</Text>
          <Text style={[styles.hint, { color: colors.mutedText }]}>{t.quietHint}</Text>
          {settings.quietHours.map((range, i) => (
            <View key={`q${i}`} style={[styles.quiet, { borderColor: colors.mutedText }]}>
              {stepper(t.from, range.start, setQuiet(i, 'start'), `q${i}s`)}
              {stepper(t.to, range.end, setQuiet(i, 'end'), `q${i}e`)}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t.remove} ${range.start}–${range.end}`}
                onPress={() => onChange({ ...settings, quietHours: removeQuietRange(settings.quietHours, i) })}
                style={styles.remove}
              >
                <Text style={{ color: colors.mutedText }}>{t.remove}</Text>
              </Pressable>
            </View>
          ))}
          {settings.quietHours.length < MAX_QUIET_HOURS ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.addQuiet}
              onPress={() => onChange({ ...settings, quietHours: addQuietRange(settings.quietHours) })}
              style={[styles.chip, styles.addQuiet, { borderColor: colors.accent }]}
            >
              <Text style={{ color: colors.accent }}>{`+ ${t.addQuiet}`}</Text>
            </Pressable>
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
  hint: { fontSize: 13, marginBottom: 8 },
  quiet: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 8, marginBottom: 10, gap: 4 },
  remove: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  addQuiet: { alignSelf: 'flex-start' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperLabel: { width: 56 },
  stepButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  time: { fontSize: 20, fontVariant: ['tabular-nums'], minWidth: 64, textAlign: 'center' },
  switchRow: { marginTop: 28, justifyContent: 'space-between', flexWrap: 'nowrap' },
  switchLabel: { flex: 1, fontSize: 16 },
  close: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
});
