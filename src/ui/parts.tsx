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
        main && { backgroundColor: t.button },
        kind === 'plain' && { borderColor: t.line, borderWidth: 1, backgroundColor: t.surface },
        kind === 'quiet' && styles.quiet,
        (pressed || props.disabled) && { opacity: props.disabled ? 0.4 : 0.7 },
      ]}
    >
      <Text style={[styles.buttonText, { color: main ? t.onButton : t.accent }]}>{props.label}</Text>
    </Pressable>
  );
}

/**
 * The top of a page: a back arrow on the left, the title centred, and optional controls on the right.
 * The two side slots are the same width, so the title stays in the middle and apart from the arrow.
 */
export function Header(props: { title: string; backLabel: string; onBack: () => void; color: string; titleColor: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.slotLeft}>
        <Pressable accessibilityRole="button" accessibilityLabel={props.backLabel} onPress={props.onBack} hitSlop={6} style={({ pressed }) => [styles.backHit, pressed && { opacity: 0.7 }]}>
          <Text style={[styles.backArrow, { color: props.color }]}>{'‹'}</Text>
        </Pressable>
      </View>
      <Text accessibilityRole="header" numberOfLines={1} style={[styles.headerTitle, { color: props.titleColor }]}>{props.title}</Text>
      <View style={styles.slotRight}>{props.right}</View>
    </View>
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
  header: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 8 },
  slotLeft: { width: 56, alignItems: 'flex-start' },
  slotRight: { width: 56, alignItems: 'flex-end' },
  backHit: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 38, lineHeight: 42, fontWeight: '400' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '700' },
  button: { minHeight: 48, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quiet: { paddingHorizontal: 8 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  choice: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, borderWidth: 1, justifyContent: 'center' },
  choiceText: { fontSize: 15 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
});
