// Everything you can do with one point, in one place.
import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { MAX_TEXT_LENGTH, cleanText } from '../core/limits';
import type { Point } from '../core/types';
import { fill, type Strings } from '../i18n/strings';
import type { Theme } from '../theme/calmStudy';
import { Button } from './parts';

export interface PointActions {
  edit: (id: string, text: string) => void;
  move: (id: string, to: Point['category']) => Promise<boolean>;
  setPrivate: (id: string, value: boolean) => void;
  putAway: (id: string) => void;
  bringBack: (id: string) => Promise<boolean>;
  deleteForGood: (id: string) => void;
}

export function PointSheet(props: { point: Point | null; t: Strings; theme: Theme; actions: PointActions; onClose: () => void }) {
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
            <>
              <Button
                label={p.category === 'daily' ? t.moveToLongTerm : t.moveToDaily}
                theme={theme}
                kind="plain"
                onPress={async () => setFull(!(await actions.move(p.id, other)))}
              />
              <View style={styles.switchRow}>
                <Text style={[styles.label, { color: theme.text }]}>{t.makePrivate}</Text>
                <Switch accessibilityLabel={t.makePrivate} value={p.private} onValueChange={(v) => actions.setPrivate(p.id, v)} />
              </View>
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
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48 },
  label: { fontSize: 16, flex: 1 },
});
