// Settings: when, how often, privacy, voice and language. Each in its own card, with a plain summary.
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { APP_VERSION } from '../appInfo';
import { FEEDBACK_EMAIL, SURVEY_URL } from '../config';
import { feedbackMailto } from '../core/feedback';
import { addQuiet, MAX_QUIET, removeQuiet, setQuiet } from '../core/quiet';
import { EVERY_CHOICES, remindersPerDay } from '../core/settings';
import { shiftTime, windowLength } from '../core/time';
import type { Language, Settings } from '../core/types';
import { fill, type Strings } from '../i18n/strings';
import { readBooked } from '../notify/diagnostics';
import { chosenVoices, voiceCounts } from '../notify/voice';
import type { Theme } from '../theme/calmStudy';
import { Button, Choice, Header } from './parts';
import { RestoreSheet, type RestoreOutcome } from './RestoreSheet';
import { OverflowMenu } from './OverflowMenu';
import { QuietAdder } from './QuietAdder';
import { TimeField } from './TimeField';

const STEP = 30;

/** Test builds only: what the phone really has booked, readable without waiting. */
function TestPanel(props: { t: Strings; theme: Theme; asleep: boolean; onSamples?: () => Promise<void> }) {
  const { t, theme } = props;
  const [info, setInfo] = useState<{ count: number; prompts: number; next: Date[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [voices, setVoices] = useState<{ en: number; hi: number; gu: number } | null>(null);
  const [used, setUsed] = useState<{ en: string; hi: string; gu: string } | null>(null);
  const load = useCallback(async () => {
    try {
      setInfo(await readBooked());
      setVoices(await voiceCounts());
      const c = await chosenVoices();
      setUsed({ en: c.en ?? '-', hi: c.hi ?? '-', gu: c.gu ?? '-' });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, props.asleep]);
  const when = (d: Date) => d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <View style={[styles.card, { borderColor: theme.line, backgroundColor: theme.surface }]}>
      <Text style={[styles.section, { color: theme.muted }]}>{t.diagTitle}</Text>
      <Text style={[styles.label, { color: theme.text }]}>{failed || !info ? t.diagUnknown : fill(t.diagBooked, { n: info.count })}</Text>
      {info && info.prompts > 0 && <Text style={[styles.hint, { color: theme.muted }]}>{fill(t.diagPrompts, { n: info.prompts })}</Text>}
      {info && info.next.length > 0 && <Text style={[styles.hint, { color: theme.muted }]}>{fill(t.diagNext, { times: info.next.map(when).join(', ') })}</Text>}
      {used && <Text style={[styles.hint, { color: theme.muted }]}>{fill(t.diagVoiceUsed, used)}</Text>}
      {voices && <Text style={[styles.hint, { color: theme.muted }]}>{fill(t.diagVoices, voices)}</Text>}
      <Text style={[styles.hint, { color: theme.muted }]}>{props.asleep ? t.diagAsleep : t.diagAwake}</Text>
      <Button label={t.diagRefresh} theme={theme} kind="plain" onPress={() => void load()} />
      {props.onSamples && <Button label={t.diagSamples} theme={theme} kind="plain" onPress={() => void props.onSamples?.()} />}
    </View>
  );
}

export function SettingsScreen(props: { t: Strings; theme: Theme; settings: Settings; onChange: (s: Settings) => void; onBack: () => void; onGo: (to: 'home' | 'help') => void; testing?: boolean; onSamples?: () => Promise<void>; onBackup: () => Promise<void>; onRestore: (text: string) => Promise<RestoreOutcome> }) {
  const { t, theme, settings: s, onChange } = props;
  const set = (patch: Partial<Settings>) => onChange({ ...s, ...patch });
  // From and until can never meet: an empty window would quietly stop every reminder.
  const shift = (key: 'from' | 'to', delta: number) => {
    const next = shiftTime(s[key], delta);
    if (next !== s[key === 'from' ? 'to' : 'from']) set({ [key]: next });
  };
  const everyLabel = (n: number) => (n < 60 ? fill(t.minutes, { n }) : fill(t.hours, { n: n % 60 === 0 ? n / 60 : (n / 60).toFixed(1) }));
  const perDay = remindersPerDay(s, windowLength(s.from, s.to));
  const [restoring, setRestoring] = useState(false);
  const sendFeedback = () => {
    const url = feedbackMailto(FEEDBACK_EMAIL, { version: APP_VERSION, platform: Platform.OS, osVersion: String(Platform.Version), language: s.language });
    // No email app on the phone: nothing to open, and nothing is lost.
    Linking.openURL(url).catch(() => undefined);
  };
  const langs: [Language, string][] = [['en', t.langEn], ['hi', t.langHi], ['gu', t.langGu]];

  const section = (title: string, children: ReactNode) => (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <Text accessibilityRole="header" style={[styles.section, { color: theme.muted }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );

  const round = (label: string, text: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.round, { borderColor: theme.accent, backgroundColor: pressed ? theme.soft : 'transparent' }]}
    >
      <Text style={[styles.roundText, { color: theme.accent }]}>{text}</Text>
    </Pressable>
  );

  const setTime = (key: 'from' | 'to', value: string) => {
    if (value !== s[key === 'from' ? 'to' : 'from']) set({ [key]: value });
  };
  // Tap the time for the phone's picker; − and + nudge it by 30 minutes.
  const stepper = (label: string, key: 'from' | 'to') => (
    <View style={styles.stepper}>
      <Text style={[styles.stepLabel, { color: theme.muted }]}>{label}</Text>
      {round(fill(t.earlierBy, { label }), '−', () => shift(key, -STEP))}
      <TimeField label={label} value={s[key]} onChange={(v) => setTime(key, v)} t={t} theme={theme} />
      {round(fill(t.laterBy, { label }), '+', () => shift(key, STEP))}
    </View>
  );

  const toggle = (label: string, hint: string, value: boolean, onValue: (v: boolean) => void) => (
    <View style={styles.switchRow}>
      <View style={styles.flex}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.hint, { color: theme.muted }]}>{hint}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={hint}
        value={value}
        onValueChange={onValue}
        trackColor={{ false: theme.line, true: theme.accent }}
        thumbColor={theme.surface}
        ios_backgroundColor={theme.line}
      />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Header
        title={t.settings}
        backLabel={t.back}
        onBack={props.onBack}
        color={theme.accent}
        titleColor={theme.text}
        right={<OverflowMenu label={t.menu} theme={theme} items={[{ label: t.home, run: () => props.onGo('home') }, { label: t.help, run: () => props.onGo('help') }]} />}
      />

      {section(
        t.sectionWhen,
        <>
          <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={t.sectionWhen}>
            <Choice label={t.modeHours} selected={s.mode === 'hours'} theme={theme} onPress={() => set({ mode: 'hours' })} />
            <Choice label={t.modeButton} selected={s.mode === 'button'} theme={theme} onPress={() => set({ mode: 'button' })} />
          </View>
          <Text style={[styles.hint, { color: theme.muted }]}>{s.mode === 'hours' ? t.modeHoursHint : t.modeButtonHint}</Text>
          {s.mode === 'hours' && (
            <>
              {stepper(t.from, 'from')}
              {stepper(t.until, 'to')}
            </>
          )}
        </>,
      )}

      {section(
        t.quietTitle,
        <>
          <Text style={[styles.hint, { color: theme.muted }]}>{t.quietHint}</Text>
          {s.quiet.map((r, i) => (
            <View key={i} style={styles.quietRow}>
              <TimeField label={`${t.quietTitle} ${i + 1}, ${t.from}`} value={r.start} onChange={(v) => set({ quiet: setQuiet(s.quiet, i, 'start', v) })} t={t} theme={theme} />
              <Text style={[styles.hint, { color: theme.muted }]}>–</Text>
              <TimeField label={`${t.quietTitle} ${i + 1}, ${t.until}`} value={r.end} onChange={(v) => set({ quiet: setQuiet(s.quiet, i, 'end', v) })} t={t} theme={theme} />
              <Button label={t.removeQuiet} theme={theme} kind="quiet" onPress={() => set({ quiet: removeQuiet(s.quiet, i) })} />
            </View>
          ))}
          {s.quiet.length < MAX_QUIET && <QuietAdder t={t} theme={theme} onAdd={(r) => set({ quiet: addQuiet(s.quiet, r) })} />}
        </>,
      )}

      {section(
        t.pace,
        <>
          <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={t.pace}>
            {EVERY_CHOICES.map((n) => (
              <Choice key={n} label={everyLabel(n)} selected={s.every === n} theme={theme} onPress={() => set({ every: n })} />
            ))}
          </View>
          <Text style={[styles.hint, { color: theme.muted }]}>{fill(t.perDay, { n: perDay, from: s.mode === 'button' ? '00:00' : s.from, to: s.mode === 'button' ? '24:00' : s.to })}</Text>
          {s.every <= 30 && <Text style={[styles.hint, { color: theme.muted }]}>{t.openDaily}</Text>}
          {s.mode === 'hours' && toggle(t.morningPromptLabel, t.morningPromptHint, s.morningPrompt, (v) => set({ morningPrompt: v }))}
        </>,
      )}

      {section(t.sectionPrivacy, toggle(t.privateMode, t.privateModeHint, s.privateMode, (v) => set({ privateMode: v })))}
      {section(
        t.sectionVoice,
        <>
          {toggle(t.soundSetting, t.soundHint, s.sound, (v) => set({ sound: v }))}
          {toggle(t.readAloudSetting, t.readAloudHint, s.readAloud, (v) => set({ readAloud: v }))}
          {toggle(t.englishInIndianSetting, t.englishInIndianHint, s.englishInIndian, (v) => set({ englishInIndian: v }))}
        </>,
      )}

      {section(
        t.language,
        <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={t.language}>
          {langs.map(([l, label]) => <Choice key={l} label={label} selected={s.language === l} theme={theme} onPress={() => set({ language: l })} />)}
        </View>,
      )}

      {section(
        t.sectionYourPoints,
        <>
          <Button label={t.backUp} theme={theme} kind="plain" onPress={() => void props.onBackup()} />
          <Text style={[styles.hint, { color: theme.muted }]}>{t.backUpHint}</Text>
          <Button label={t.restore} theme={theme} kind="plain" onPress={() => setRestoring(true)} />
        </>,
      )}

      {section(
        t.sectionFeedback,
        <>
          <Button label={t.sendFeedback} theme={theme} kind="plain" onPress={sendFeedback} />
          <Text style={[styles.hint, { color: theme.muted }]}>{t.feedbackHint}</Text>
          {SURVEY_URL !== '' && <Button label={t.takeSurvey} theme={theme} kind="plain" onPress={() => void Linking.openURL(SURVEY_URL).catch(() => undefined)} />}
        </>,
      )}

      {props.testing && <TestPanel t={t} theme={theme} asleep={s.asleep} onSamples={props.onSamples} />}

      <Text style={[styles.hint, { color: theme.muted, textAlign: 'center' }]}>{t.storedNote}</Text>
      <Text style={[styles.hint, { color: theme.muted, textAlign: 'center' }]}>{fill(t.versionLabel, { v: APP_VERSION })}</Text>
      <RestoreSheet visible={restoring} t={t} theme={theme} onRestore={props.onRestore} onClose={() => setRestoring(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 14, paddingBottom: 48 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spacer: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  big: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  quietRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stepLabel: { fontSize: 15, minWidth: 56 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  roundText: { fontSize: 22, fontWeight: '600', lineHeight: 26 },
  time: { fontSize: 20, fontWeight: '600', minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
  label: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 14, lineHeight: 20 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48 },
  flex: { flex: 1, gap: 2 },
});
