import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Point } from '../core/types';
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

  const load = useCallback(async () => setPoints(await listArchived()), []);
  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const restore = async (id: string) => {
    await restorePoint(id);
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
        <FlatList
          data={points}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 12 }}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.mutedText }]}>{t.archivedEmpty}</Text>}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: colors.mutedText }]}>
              <Text style={[styles.cardText, { color: colors.text }]}>{item.prompt}</Text>
              <Text style={[styles.date, { color: colors.mutedText }]}>
                {t.added.replace('{date}', new Date(item.createdAt).toLocaleDateString(item.language))}
              </Text>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" accessibilityLabel={t.restore} onPress={() => void restore(item.id)} style={styles.action}>
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
  date: { marginTop: 6, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 12 },
  action: { paddingVertical: 8, paddingRight: 8 },
});
