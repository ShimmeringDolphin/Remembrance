// Restore points from a backup the user pasted. Nothing is read from anywhere else; nothing is sent anywhere.
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './AppText';

import type { Strings } from '../i18n/strings';
import type { Theme } from '../theme/calmStudy';
import { Button } from './parts';

/** What `onRestore` found: not a backup, or how many points went in. */
export type RestoreOutcome = { ok: false } | { ok: true; message: string };

export function RestoreSheet(props: { visible: boolean; t: Strings; theme: Theme; onRestore: (text: string) => Promise<RestoreOutcome>; onClose: () => void }) {
  const { t, theme } = props;
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => {
    setText('');
    setNote(null);
    props.onClose();
  };
  const restore = async () => {
    setBusy(true);
    try {
      const r = await props.onRestore(text);
      setNote(r.ok ? r.message : t.restoreBad);
      if (r.ok) setText('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.scrim, { backgroundColor: theme.scrim }]}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{t.restoreTitle}</Text>
          <Text style={[styles.body, { color: theme.muted }]}>{t.restoreBody}</Text>
          <TextInput
            value={text}
            onChangeText={(v) => {
              setText(v);
              setNote(null);
            }}
            multiline
            placeholder={t.restorePlaceholder}
            placeholderTextColor={theme.muted}
            accessibilityLabel={t.restorePlaceholder}
            autoCorrect={false}
            style={[styles.input, { color: theme.text, borderColor: theme.line, backgroundColor: theme.background }]}
          />
          {note && <Text accessibilityLiveRegion="polite" style={[styles.body, { color: theme.text }]}>{note}</Text>}
          <Button label={t.restoreButton} theme={theme} disabled={busy || text.trim() === ''} onPress={() => void restore()} />
          <Button label={t.close} theme={theme} kind="quiet" onPress={close} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 24, paddingBottom: 40, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 14 },
  title: { fontSize: 22, fontWeight: '700', lineHeight: 30 },
  body: { fontSize: 16, lineHeight: 24 },
  input: { minHeight: 120, maxHeight: 220, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, textAlignVertical: 'top' },
});
