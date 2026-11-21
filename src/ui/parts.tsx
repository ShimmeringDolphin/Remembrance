// Small shared pieces. Every button has an accessibility label.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme/calmStudy';

export function Button(props: { label: string; onPress: () => void; theme: Theme; kind?: 'main' | 'plain' | 'quiet'; disabled?: boolean; hint?: string }) {
  const { theme: t, kind = 'main' } = props;
  const main = kind === 'main';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityHint={props.hint}
      accessibilityState={{ disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.button,
        main && { backgroundColor: t.accent },
        kind === 'plain' && { borderColor: t.line, borderWidth: 1, backgroundColor: t.surface },
        kind === 'quiet' && styles.quiet,
        (pressed || props.disabled) && { opacity: props.disabled ? 0.4 : 0.7 },
      ]}
    >
      <Text style={[styles.buttonText, { color: main ? t.onAccent : t.accent }]}>{props.label}</Text>
    </Pressable>
  );
}

/** One of a few choices; the chosen one is filled so it is clear which is picked. */
export function Choice(props: { label: string; selected: boolean; onPress: () => void; theme: Theme }) {
  const t = props.theme;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.selected, checked: props.selected }}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.choice,
        { borderColor: props.selected ? t.accent : t.line, backgroundColor: props.selected ? t.accent : t.surface },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.choiceText, { color: props.selected ? t.onAccent : t.text }]}>{props.label}</Text>
    </Pressable>
  );
}

export function Card(props: { children: ReactNode; theme: Theme }) {
  return <View style={[styles.card, { backgroundColor: props.theme.surface, borderColor: props.theme.line }]}>{props.children}</View>;
}

const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quiet: { paddingHorizontal: 8 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  choice: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, borderWidth: 1, justifyContent: 'center' },
  choiceText: { fontSize: 15 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
});
