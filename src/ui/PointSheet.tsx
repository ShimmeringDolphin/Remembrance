// Everything you can do with one point, in one place.
import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from './AppText';

import { daysFromToday, MAX_DAILY_DAYS } from '../core/expiry';
import { MAX_TEXT_LENGTH, cleanText } from '../core/limits';
import { starSize } from '../core/sky';
import { homeRadius } from '../core/star';
import { MAX_EVERY, PACES, paceFor } from '../core/pace';
import type { Pace, Point } from '../core/types';
import { fill, type Strings } from '../i18n/strings';
import { onTint, tint, type Theme } from '../theme/calmStudy';
import { Button, Choice, Header } from './parts';
import { Star } from './Star';
import { VoiceRecorder } from './VoiceRecorder';

export interface PointActions {
  edit: (id: string, text: string) => void;
  move: (id: string, to: Point['category']) => Promise<boolean>;
  /** A last day of 1 to 6 days, or more for Long-term; false when Long-term is full. */
  setDays: (id: string, days: number) => Promise<boolean>;
  setPrivate: (id: string, value: boolean) => void;
  setPace: (id: string, pace: Pace) => void;
  setVoice: (id: string, voice: string | null) => void;
  putAway: (id: string) => void;
  bringBack: (id: string) => Promise<boolean>;
  deleteForGood: (id: string) => void;
}

export function PointSheet(props: { point: Point | null; t: Strings; theme: Theme; actions: PointActions; onClose: () => void; /** Live Daily points set to Every reminder. */ everyCount: number }) {
  const { point: p, t, theme, actions } = props;
  const [text, setText] = useState(p?.text ?? '');
  const [full, setFull] = useState(false);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    setText(p?.text ?? '');
    setFull(false);
  }, [p?.id]);
  if (!p) return null;
  const colour = tint(theme, p.category);
  const pillTheme = { ...theme, button: colour, onButton: onTint(theme, p.category) };
  const daysLeft = daysFromToday(p.expiresAt, new Date());
  const clean = cleanText(text);
  const other = p.category === 'daily' ? 'long_term' : 'daily';
  const seen = p.appearances === 0 ? t.appearedNone : p.appearances === 1 ? t.appearedOnce : fill(t.appeared, { n: p.appearances });
  const paceLabel: Record<Pace, string> = { every: t.paceEvery, often: t.paceOften, normal: t.paceNormal, rarely: t.paceRarely };
  // Only Daily points have a pace; the cap leaves at least one place in each reminder rotating.
  const everyFull = p.pace !== 'every' && props.everyCount >= MAX_EVERY;
  const fullText = fill(t.full, { name: other === 'daily' ? t.daily : t.longTerm });

  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View style={[styles.page, { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.pinned}>
          <Header title={p.category === 'daily' ? t.daily : t.longTerm} backLabel={t.close} onBack={props.onClose} color={theme.text} titleColor={theme.text} />
        </View>
        <ScrollView style={styles.sheet} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.starLine} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.thread, { backgroundColor: p.archived ? theme.thread : colour }]} />
            <View style={[styles.starBack, { backgroundColor: theme.background }]}>
              <Star radius={homeRadius(starSize(p.appearances)) + 4} color={p.archived ? theme.thread : colour} />
            </View>
          </View>
          <Text style={[styles.came, { color: theme.text }]}>{seen}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            maxLength={MAX_TEXT_LENGTH}
            multiline
            accessibilityLabel={t.edit}
            style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
          />
          {clean && clean !== p.text && <Button label={t.save} theme={theme} onPress={() => actions.edit(p.id, clean)} />}

          {!p.archived && (
            <View style={styles.paceRow} accessibilityRole="radiogroup" accessibilityLabel={t.saveTo}>
              {(['daily', 'long_term'] as const).map((c) => (
                <Choice
                  key={c}
                  label={c === 'daily' ? t.daily : t.longTerm}
                  selected={p.category === c}
                  theme={{ ...theme, button: tint(theme, c), onButton: onTint(theme, c) }}
                  onPress={async () => (p.category === c ? undefined : setFull(!(await actions.move(p.id, c))))}
                />
              ))}
            </View>
          )}

          {!p.archived && p.category === 'daily' && (
            <View style={[styles.paceBox, { backgroundColor: theme.surface }]} accessibilityRole="radiogroup" accessibilityLabel={t.repeatFor}>
              <Text style={[styles.label, { color: theme.text }]}>{t.repeatFor}</Text>
              <View style={styles.paceRow}>
                {Array.from({ length: MAX_DAILY_DAYS + 1 }, (_, i) => i + 1).map((d) => (
                  <Choice
                    key={d}
                    label={d > MAX_DAILY_DAYS ? '∞' : String(d)}
                    selected={d <= MAX_DAILY_DAYS && daysLeft === d}
                    theme={pillTheme}
                    onPress={async () => setFull(!(await actions.setDays(p.id, d)))}
                  />
                ))}
              </View>
              <Text style={[styles.muted, { color: theme.muted }]}>{t.longTermNote}</Text>
            </View>
          )}
          {!p.archived && p.category === 'long_term' && (
            <View style={[styles.paceBox, { backgroundColor: theme.surface }]}>
              <Text style={[styles.muted, { color: theme.text }]}>{fill(t.keptForGood, { date: new Date(p.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) })}</Text>
            </View>
          )}

          {!p.archived && (
            <View style={[styles.privateRow, { backgroundColor: theme.surface }]}>
              <View style={styles.flex}>
                <Text style={[styles.label, { color: theme.text }]}>{t.makePrivate}</Text>
                <Text style={[styles.muted, { color: theme.muted }]}>{t.privateHint}</Text>
              </View>
              <Switch
                accessibilityLabel={t.makePrivate}
                accessibilityHint={t.privateHint}
                value={p.private}
                onValueChange={(v) => actions.setPrivate(p.id, v)}
                trackColor={{ false: theme.thread, true: theme.button }}
                thumbColor={p.private ? theme.onButton : theme.muted}
                ios_backgroundColor={theme.chip}
              />
            </View>
          )}

          {!p.archived && (
            <View style={[styles.paceBox, { backgroundColor: theme.surface }]} accessibilityRole="radiogroup" accessibilityLabel={t.pointPace}>
              <Text style={[styles.label, { color: theme.text }]}>{t.pointPace}</Text>
              <View style={styles.paceRow}>
                {PACES[p.category].map((pace) => (
                  <Choice
                    key={pace}
                    label={paceLabel[pace]}
                    selected={paceFor(p) === pace}
                    theme={theme}
                    onPress={() => (pace === 'every' && everyFull ? undefined : actions.setPace(p.id, pace))}
                  />
                ))}
              </View>
              <Text style={[styles.muted, { color: theme.muted }]}>{everyFull && p.category === 'daily' ? t.paceEveryFull : p.category === 'daily' ? t.pointPaceHint : t.pointPaceHintLong}</Text>
            </View>
          )}

          {!p.archived && (
            <VoiceRecorder key={p.id} point={p} t={t} theme={theme} onSaved={(name) => actions.setVoice(p.id, name)} onRemove={() => actions.setVoice(p.id, null)} />
          )}

          {!p.archived && (
            <>
              <Button label={t.putAway} hint={t.putAwayHint} theme={theme} kind="plain" onPress={() => actions.putAway(p.id)} />
            </>
          )}
          {p.archived && (
            <>
              <Button label={t.bringBack} theme={theme} kind="plain" onPress={async () => setFull(!(await actions.bringBack(p.id)))} />
              <Button
                label={t.deleteForGood}
                theme={theme}
                kind="quiet"
                onPress={() =>
                  Alert.alert(t.deleteForGood, t.deleteConfirm, [
                    { text: t.cancel, style: 'cancel' },
                    { text: t.deleteForGood, style: 'destructive', onPress: () => actions.deleteForGood(p.id) },
                  ])
                }
              />
            </>
          )}
          {full && <Text accessibilityLiveRegion="polite" style={[styles.muted, { color: theme.muted }]}>{p.archived ? fill(t.full, { name: p.category === 'daily' ? t.daily : t.longTerm }) : fullText}</Text>}
          <Button label={t.close} theme={theme} kind="quiet" onPress={props.onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  pinned: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  sheet: { flex: 1 },
  starLine: { height: 36, justifyContent: 'center', alignItems: 'center' },
  thread: { position: 'absolute', left: 0, right: 0, height: 2, borderRadius: 1 },
  starBack: { paddingHorizontal: 12 },
  came: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  content: { padding: 24, paddingBottom: 40, gap: 12 },
  input: { minHeight: 120, borderRadius: 14, padding: 12, fontSize: 18, textAlignVertical: 'top' },
  muted: { fontSize: 15, lineHeight: 22 },
  paceBox: { borderRadius: 14, padding: 14, gap: 8 },
  paceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14 },
  flex: { flex: 1, gap: 2 },
  label: { fontSize: 17, fontWeight: '600' },
});
