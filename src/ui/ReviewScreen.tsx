import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Point } from '../core/types';
import type { Strings } from '../i18n/strings';
import type { calmStudy } from '../theme/calmStudy';

type Colors = (typeof calmStudy)['light'] | (typeof calmStudy)['dark'];

interface Props {
  visible: boolean;
  /** The points to go over, already filtered and ordered (see core/review.ts). */
  points: Point[];
  t: Strings;
  colors: Colors;
  onClose: () => void;
}

/**
 * Review now: shows the points a reminder was about, or every active point when opened from the
 * app. Answers (Remembered / Again soon) are not part of this first version.
 */
export function ReviewScreen({ visible, points, t, colors, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        <Text style={[styles.heading, { color: colors.text }]}>{t.reviewNow}</Text>
        <FlatList
          data={points}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.mutedText }]}>{t.reviewEmpty}</Text>}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: colors.accent }]}>
              <Text style={[styles.cardText, { color: colors.text }]}>{item.prompt}</Text>
            </View>
          )}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.done}
          onPress={onClose}
          style={[styles.done, { backgroundColor: colors.accent, marginBottom: insets.bottom + 16 }]}
        >
          <Text style={{ color: colors.onAccent, fontWeight: '600' }}>{t.done}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  heading: { fontSize: 22, fontWeight: '600', marginBottom: 8 },
  list: { paddingVertical: 8, gap: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 18 },
  cardText: { fontSize: 20, lineHeight: 30 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 16, paddingHorizontal: 12 },
  done: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
});
