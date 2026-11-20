import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Point } from '../core/types';
import { MAX_POINTS_PER_CATEGORY } from '../core/limits';
import { deleteArchivedPoint, listArchived, restorePoint } from '../db/points';
import type { Strings } from '../i18n/strings';
import type { calmStudy } from '../theme/calmStudy';

type Colors = (typeof calmStudy)['light'] | (typeof calmStudy)['dark'];

interface Props {
  visible: boolean;
  t: Strings;
  colors: Colors;
  onClose: () => void;
  /** Called after a point is restored so the lists and reminders refresh. */
  onRestored: () => void;
}

export function ArchivedScreen({ visible, t, colors, onClose, onRestored }: Props) {
  const insets = useSafeAreaInsets();
  const [points, setPoints] = useState<Point[]>([]);
  const [fullMessage, setFullMessage] = useState<string | null>(null);

  const load = useCallback(async () => setPoints(await listArchived()), []);
  useEffect(() => {
    if (visible) void load();
    else setFullMessage(null);
  }, [visible, load]);

  const restore = async (point: Point) => {
    if (!(await restorePoint(point.id))) {
      const text = point.category === 'daily' ? t.limitDaily : t.limitLongTerm;
      setFullMessage(text.replace('{n}', String(MAX_POINTS_PER_CATEGORY)));
      return;
    }
    setFullMessage(null);
    await load();
    onRestored();
  };

  const confirmDelete = (id: string) =>
    Alert.alert(t.deleteTitle, t.deleteBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.deleteForever,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteArchivedPoint(id);
            await load();
          })();
        },
      },
    ]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        <View style={styles.header}>
          <Text style={[styles.heading, { color: colors.text }]}>{t.archived}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose} style={styles.close}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>{t.close}</Text>
          </Pressable>
        </View>
        {fullMessage ? <Text style={[styles.empty, { color: colors.text, marginTop: 0, marginBottom: 12 }]}>{fullMessage}</Text> : null}
        <FlatList
          data={points}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 12 }}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.mutedText }]}>{t.archivedEmpty}</Text>}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: colors.mutedText }]}>
              <Text style={[styles.cardText, { color: colors.text }]}>{item.prompt}</Text>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" accessibilityLabel={t.restore} onPress={() => void restore(item)} style={styles.action}>
                  <Text style={{ color: colors.accent, fontWeight: '600' }}>{t.restore}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={t.deleteForever} onPress={() => confirmDelete(item.id)} style={styles.action}>
                  <Text style={{ color: colors.mutedText }}>{t.deleteForever}</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heading: { fontSize: 22, fontWeight: '600' },
  close: { paddingVertical: 12, paddingHorizontal: 8 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 16, paddingHorizontal: 24 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16 },
  cardText: { fontSize: 18, lineHeight: 26 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 12 },
  action: { paddingVertical: 8, paddingRight: 8 },
});
