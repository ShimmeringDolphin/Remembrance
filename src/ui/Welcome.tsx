// First run: one box and a language choice. No setup, no questions; sensible defaults are already in place.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './AppText';

import { MAX_TEXT_LENGTH, cleanText } from '../core/limits';
import type { Language } from '../core/types';
import type { Strings } from '../i18n/strings';
import type { Theme } from '../theme/calmStudy';
import { Button, Choice } from './parts';

export function Welcome(props: { t: Strings; theme: Theme; language: Language; onLanguage: (l: Language) => void; onKeep: (text: string) => void }) {
  const { t, theme } = props;
  const [text, setText] = useState('');
  // A different example each day, with no timer.
  const example = [t.example1, t.example2, t.example3][new Date().getDate() % 3];
  const clean = cleanText(text);
  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <View style={styles.langs} accessibilityRole="radiogroup" accessibilityLabel={t.language}>
          {([['en', t.langEn], ['hi', t.langHi], ['gu', t.langGu]] as [Language, string][]).map(([l, label]) => (
            <Choice key={l} label={label} selected={props.language === l} theme={theme} onPress={() => props.onLanguage(l)} />
          ))}
        </View>
        <Text style={[styles.brand, { color: theme.text }]}>{t.appName}</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{t.welcomeTitle}</Text>
        <Text style={[styles.body, { color: theme.muted }]}>{t.welcomeBody}</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={example}
          placeholderTextColor={theme.muted}
          maxLength={MAX_TEXT_LENGTH}
          multiline
          autoFocus
          accessibilityLabel={t.addPlaceholder}
          style={[styles.input, { color: theme.text, borderColor: theme.line, backgroundColor: theme.surface }]}
        />
        <Button label={t.keep} theme={theme} disabled={!clean} onPress={() => clean && props.onKeep(clean)} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  inner: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  langs: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  brand: { fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '700', lineHeight: 36 },
  body: { fontSize: 17, lineHeight: 25 },
  input: { minHeight: 96, borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 18, textAlignVertical: 'top' },
});
