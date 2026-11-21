import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_DAILY_DAYS, resolveDays } from '../core/expiry';
import type { Category, Point } from '../core/types';
import { MAX_PROMPT_LENGTH } from '../db/points';
import type { Strings } from '../i18n/strings';
import type { calmStudy } from '../theme/calmStudy';

type Colors = (typeof calmStudy)['light'] | (typeof calmStudy)['dark'];

interface Props {
  visible: boolean;
  /** The point being edited, or null when adding. */
  point: Point | null;
  defaultCategory: Category;
  t: Strings;
  colors: Colors;
  /** `days` is set only when adding a Daily point. */
  onSave: (value: { prompt: string; category: Category; days?: number }) => void;
  onArchive: (id: string) => void;
  onCancel: () => void;
}

export function PointEditor({ visible, point, defaultCategory, t, colors, onSave, onArchive, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState<Category>(defaultCategory);
  const [days, setDays] = useState(1);

  useEffect(() => {
    if (visible) {
      setPrompt(point?.prompt ?? '');
      setCategory(point?.category ?? defaultCategory);
      setDays(1);
    }
  }, [visible, point, defaultCategory]);

  const canSave = prompt.trim().length > 0;
  const showDays = point === null && category === 'daily';

  const save = () => {
    if (!showDays) {
      onSave({ prompt, category });
      return;
    }
    if (resolveDays(days).longTerm) {
      // Longer than a Daily point may run: tell the user it will be saved as Long-term.
      Alert.alert(t.longTermTitle, t.longTermBody, [
        { text: t.cancel, style: 'cancel' },
        { text: t.saveLongTerm, onPress: () => onSave({ prompt, category: 'long_term' }) },
      ]);
      return;
    }
    onSave({ prompt, category, days });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
      >
        <Text style={[styles.heading, { color: colors.text }]}>{point ? t.editPoint : t.addPoint}</Text>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder={t.pointPlaceholder}
          placeholderTextColor={colors.mutedText}
          maxLength={MAX_PROMPT_LENGTH}
          multiline
          autoFocus
          style={[styles.input, { color: colors.text, borderColor: colors.mutedText }]}
        />
        <Text style={[styles.label, { color: colors.mutedText }]}>{t.category}</Text>
        <View style={styles.row}>
          {(['daily', 'long_term'] as const).map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityState={{ selected: category === c }}
              onPress={() => setCategory(c)}
              style={[styles.chip, { borderColor: colors.accent, backgroundColor: category === c ? colors.accent : 'transparent' }]}
            >
              <Text style={{ color: category === c ? colors.onAccent : colors.accent }}>
                {c === 'daily' ? t.daily : t.longTerm}
              </Text>
            </Pressable>
          ))}
        </View>
        {showDays ? (
          <>
            <Text style={[styles.label, { color: colors.mutedText }]}>{t.repeatFor}</Text>
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="-"
                disabled={days <= 1}
                onPress={() => setDays((d) => Math.max(1, d - 1))}
                style={[styles.chip, { borderColor: colors.accent, opacity: days <= 1 ? 0.4 : 1 }]}
              >
                <Text style={{ color: colors.accent }}>−</Text>
              </Pressable>
              <Text style={{ color: colors.text, fontSize: 18, minWidth: 80, textAlign: 'center' }}>
                {days === 1 ? t.dayCount : t.daysCount.replace('{n}', String(days))}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="+"
                disabled={days >= 30}
                onPress={() => setDays((d) => Math.min(30, d + 1))}
                style={[styles.chip, { borderColor: colors.accent, opacity: days >= 30 ? 0.4 : 1 }]}
              >
                <Text style={{ color: colors.accent }}>+</Text>
              </Pressable>
            </View>
            <Text style={[styles.note, { color: colors.mutedText }]}>
              {days > MAX_DAILY_DAYS ? t.longTermBody : t.dailyNote}
            </Text>
          </>
        ) : null}
        <View style={styles.spacer} />
        <View style={styles.row}>
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.button}>
            <Text style={{ color: colors.accent }}>{t.cancel}</Text>
          </Pressable>
          {point ? (
            <Pressable accessibilityRole="button" onPress={() => onArchive(point.id)} style={styles.button}>
              <Text style={{ color: colors.mutedText }}>{t.archive}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={!canSave}
            onPress={save}
            style={[styles.button, styles.primary, { backgroundColor: colors.accent, opacity: canSave ? 1 : 0.4 }]}
          >
            <Text style={{ color: colors.onAccent, fontWeight: '600' }}>{t.save}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  heading: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, fontSize: 18, minHeight: 100, textAlignVertical: 'top' },
  label: { marginTop: 20, marginBottom: 8, fontSize: 14 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  note: { marginTop: 8, fontSize: 14 },
  spacer: { flex: 1 },
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  primary: { marginLeft: 'auto' },
});
