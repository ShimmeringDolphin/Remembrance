// Everything you can do with one point, in one place.
import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from './AppText';

import { MAX_TEXT_LENGTH, cleanText } from '../core/limits';
import { MAX_EVERY, PACES, paceFor } from '../core/pace';
import type { Pace, Point } from '../core/types';
import { fill, type Strings } from '../i18n/strings';
import type { Theme } from '../theme/calmStudy';
import { Button, Choice } from './parts';
import { VoiceRecorder } from './VoiceRecorder';

export interface PointActions {
  edit: (id: string, text: string) => void;
  move: (id: string, to: Point['category']) => Promise<boolean>;
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
  useEffect(() => {
    setText(p?.text ?? '');
    setFull(false);
  }, [p?.id]);
  if (!p) return null;
  const clean = cleanText(text);
  const other = p.category === 'daily' ? 'long_term' : 'daily';
  const seen = p.appearances === 0 ? t.appearedNone : p.appearances === 1 ? t.appearedOnce : fill(t.appeared, { n: p.appearances });
  const paceLabel: Record<Pace, string> = { every: t.paceEvery, often: t.paceOften, normal: t.paceNormal, rarely: t.paceRarely };
  // Only Daily points have a pace; the cap leaves at least one place in each reminder rotating.
  const everyFull = p.pace !== 'every' && props.everyCount >= MAX_EVERY;
  const fullText = fill(t.full, { name: other === 'daily' ? t.daily : t.longTerm });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={props.onClose}>
      <View style={[styles.scrim, { backgroundColor: theme.scrim }]}>
        <ScrollView style={[styles.sheet, { backgroundColor: theme.surface }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            value={text}
            onChangeText={setText}
            maxLength={MAX_TEXT_LENGTH}
            multiline
            accessibilityLabel={t.edit}
            style={[styles.input, { color: theme.text, borderColor: theme.line }]}
          />
          {clean && clean !== p.text && <Button label={t.save} theme={theme} onPress={() => actions.edit(p.id, clean)} />}
          <Text style={[styles.muted, { color: theme.muted }]}>{seen}</Text>

          {!p.archived && (
            <View style={[styles.privateRow, { borderColor: theme.line, backgroundColor: theme.soft }]}>
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
            <View style={[styles.paceBox, { borderColor: theme.line }]} accessibilityRole="radiogroup" accessibilityLabel={t.pointPace}>
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
              <Button
                label={p.category === 'daily' ? t.moveToLongTerm : t.moveToDaily}
                theme={theme}
                kind="plain"
                onPress={async () => setFull(!(await actions.move(p.id, other)))}
              />
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
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  content: { padding: 24, paddingBottom: 40, gap: 12 },
  input: { minHeight: 80, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 18, textAlignVertical: 'top' },
  muted: { fontSize: 15, lineHeight: 22 },
  paceBox: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  paceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12 },
  flex: { flex: 1, gap: 2 },
  label: { fontSize: 17, fontWeight: '600' },
});
