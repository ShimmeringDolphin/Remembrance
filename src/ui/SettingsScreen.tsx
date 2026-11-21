// Tiny on purpose: when, how often, pause, privacy, language.
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { shiftTime } from '../core/time';
import type { Language, Pace, Settings } from '../core/types';
import type { Strings } from '../i18n/strings';
import type { Theme } from '../theme/calmStudy';
import { Button, Card, Choice } from './parts';

const STEP = 30;

export function SettingsScreen(props: { t: Strings; theme: Theme; settings: Settings; onChange: (s: Settings) => void; onBack: () => void }) {
  const { t, theme, settings: s, onChange } = props;
  const set = (patch: Partial<Settings>) => onChange({ ...s, ...patch });
  // From and until can never meet: an empty window would quietly stop every reminder.
  const shift = (key: 'from' | 'to', delta: number) => {
    const next = shiftTime(s[key], delta);
    if (next !== s[key === 'from' ? 'to' : 'from']) set({ [key]: next });
  };
  const time = (label: string, key: 'from' | 'to') => (
    <View style={styles.timeRow}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Button label={`${t.earlier} (${label})`} theme={theme} kind="plain" onPress={() => shift(key, -STEP)} />
      <Text accessibilityLabel={`${label} ${s[key]}`} style={[styles.time, { color: theme.text }]}>{s[key]}</Text>
      <Button label={`${t.later} (${label})`} theme={theme} kind="plain" onPress={() => shift(key, STEP)} />
    </View>
  );
  const paces: [Pace, string][] = [['often', t.paceOften], ['regular', t.paceRegular], ['gentle', t.paceGentle]];
  const langs: [Language, string][] = [['en', t.langEn], ['hi', t.langHi], ['gu', t.langGu]];

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.top}>
        <Button label={t.back} theme={theme} kind="quiet" onPress={props.onBack} />
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{t.settings}</Text>
      </View>
      <Card theme={theme}>
        {time(t.from, 'from')}
        {time(t.until, 'to')}
      </Card>
      <Card theme={theme}>
        <Text style={[styles.label, { color: theme.text }]}>{t.pace}</Text>
        <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={t.pace}>
          {paces.map(([p, label]) => <Choice key={p} label={label} selected={s.pace === p} theme={theme} onPress={() => set({ pace: p })} />)}
        </View>
      </Card>
      <Card theme={theme}>
        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: theme.text }]}>{t.pause}</Text>
          <Switch accessibilityLabel={t.pause} value={s.paused} onValueChange={(v) => set({ paused: v })} />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={[styles.label, { color: theme.text }]}>{t.privateMode}</Text>
            <Text style={[styles.hint, { color: theme.muted }]}>{t.privateModeHint}</Text>
          </View>
          <Switch accessibilityLabel={t.privateMode} value={s.privateMode} onValueChange={(v) => set({ privateMode: v })} />
        </View>
      </Card>
      <Card theme={theme}>
        <Text style={[styles.label, { color: theme.text }]}>{t.language}</Text>
        <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={t.language}>
          {langs.map(([l, label]) => <Choice key={l} label={label} selected={s.language === l} theme={theme} onPress={() => set({ language: l })} />)}
        </View>
      </Card>
      <Text style={[styles.hint, { color: theme.muted }]}>{t.storedNote}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 14, paddingBottom: 48 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  time: { fontSize: 20, fontWeight: '600', minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
  label: { fontSize: 16, fontWeight: '600', minWidth: 56 },
  hint: { fontSize: 14, lineHeight: 20 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48 },
  flex: { flex: 1 },
});
