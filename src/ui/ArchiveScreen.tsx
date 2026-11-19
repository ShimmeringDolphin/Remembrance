import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Point } from '../core/types';
import { listArchivedPoints, restorePoint } from '../db/points';
import type { Strings } from '../i18n/strings';
import type { calmStudy } from '../theme/calmStudy';

type Colors = (typeof calmStudy)['light'] | (typeof calmStudy)['dark'];

interface Props {
  visible: boolean;
  t: Strings;
  colors: Colors;
  /** Called after a point is restored, so the main list and reminders can be refreshed. */
  onRestored: () => void;
  onClose: () => void;
}

/** Lists archived points (both categories) and lets the user bring them back. */
export function ArchiveScreen({ visible, t, colors, onRestored, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [points, setPoints] = useState<Point[]>([]);

  useEffect(() => {
    if (!visible) {
      setPoints([]); // release the list while hidden
      return;
    }
    void listArchivedPoints().then(setPoints);
  }, [visible]);

  const restore = async (id: string) => {
    await restorePoint(id);
    setPoints((current) => current.filter((p) => p.id !== id));
    onRestored();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        <Text style={[styles.heading, { color: colors.text }]}>{t.archived}</Text>
        <FlatList
          data={points}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.mutedText }]}>{t.archivedEmpty}</Text>}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: colors.mutedText }]}>
              <Text style={[styles.cardText, { color: colors.text }]}>{item.prompt}</Text>
              <View style={styles.cardFooter}>
                <Text style={{ color: colors.mutedText }}>{item.category === 'daily' ? t.daily : t.longTerm}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t.restore}: ${item.prompt}`}
                  onPress={() => void restore(item.id)}
                  style={[styles.restore, { borderColor: colors.accent }]}
                >
                  <Text style={{ color: colors.accent, fontWeight: '600' }}>{t.restore}</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.close}
          onPress={onClose}
          style={[styles.close, { backgroundColor: colors.accent, marginBottom: insets.bottom + 16 }]}
        >
          <Text style={{ color: colors.onAccent, fontWeight: '600' }}>{t.close}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  heading: { fontSize: 22, fontWeight: '600', marginBottom: 8 },
  list: { paddingVertical: 8, gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16, gap: 12 },
  cardText: { fontSize: 18, lineHeight: 26 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  restore: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 16, paddingHorizontal: 12 },
  close: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
});
