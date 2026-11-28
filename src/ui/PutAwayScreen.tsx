// The points put away, kept out of Home. Tap one to bring it back or delete it for good.
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { PointText, Text } from './AppText';

import type { Point } from '../core/types';
import { type Strings } from '../i18n/strings';
import { tint, type Theme } from '../theme/calmStudy';
import { starSize } from '../core/sky';
import { homeRadius } from '../core/star';
import { Header } from './parts';
import { Star } from './Star';

export function PutAwayScreen(props: { t: Strings; theme: Theme; points: Point[]; onOpen: (id: string) => void; onBack: () => void }) {
  const { t, theme } = props;
  const away = props.points.filter((p) => p.archived);
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={styles.pinned}>
        <Header title={t.putAwayTitle} backLabel={t.back} onBack={props.onBack} color={theme.text} titleColor={theme.text} />
      </View>
      <FlatList
        data={away}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={[styles.empty, { color: theme.muted }]}>{t.putAwayEmpty}</Text>}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.text}
            accessibilityHint={t.openPoint}
            onPress={() => props.onOpen(item.id)}
            style={({ pressed }) => [styles.point, { backgroundColor: theme.surface }, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.bullet}>
              <Star radius={homeRadius(starSize(item.appearances))} color={theme.thread} />
            </View>
            <PointText style={[styles.text, { color: theme.muted }]}>{item.text}</PointText>
            <View style={[styles.dot, { backgroundColor: tint(theme, item.category) }]} accessibilityElementsHidden />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pinned: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48, gap: 10 },
  empty: { fontSize: 16, textAlign: 'center', marginTop: 32 },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, padding: 14 },
  bullet: { width: 32, alignItems: 'center', paddingTop: 2 },
  text: { flex: 1, fontSize: 17, lineHeight: 24 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 7 },
});
