import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { MAX_PROMPT_LENGTH } from '../db/points';
import type { Strings } from '../i18n/strings';
import type { calmStudy } from '../theme/calmStudy';

type Colors = (typeof calmStudy)['light'] | (typeof calmStudy)['dark'];

interface Props {
  t: Strings;
  colors: Colors;
  onSave: (prompt: string) => Promise<void>;
}

/** First run: one box and one button. Nothing to choose, nothing to set up. */
export function Welcome({ t, colors, onSave }: Props) {
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  // A different example each time the screen opens, so the box never looks empty or stale.
  const [example] = useState(() => [t.example1, t.example2, t.example3][Math.floor(Math.random() * 3)]);
  const canSave = prompt.trim().length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(prompt);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t.welcomeTitle}
      </Text>
      <Text style={[styles.hint, { color: colors.mutedText }]}>{t.welcomeHint}</Text>
      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder={example}
        placeholderTextColor={colors.mutedText}
        maxLength={MAX_PROMPT_LENGTH}
        multiline
        accessibilityLabel={t.welcomeTitle}
        style={[styles.input, { color: colors.text, borderColor: colors.mutedText }]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.save}
        accessibilityState={{ disabled: !canSave }}
        disabled={!canSave}
        onPress={() => void save()}
        style={[styles.save, { backgroundColor: colors.accent, opacity: canSave ? 1 : 0.4 }]}
      >
        <Text style={{ color: colors.onAccent, fontWeight: '600', fontSize: 17 }}>{t.save}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 16 },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '600' },
  hint: { fontSize: 16, lineHeight: 23 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, fontSize: 19, minHeight: 110, textAlignVertical: 'top' },
  save: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
