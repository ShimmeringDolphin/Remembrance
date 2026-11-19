// Experimental (open-creativity): modal that shows Memory Sky and the gentle rhythm line.
// Loads points, memories and the recent log only while visible and drops them on close.
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rhythm } from '../../core/labs/insights';
import type { PointMemory } from '../../core/labs/memory';
import type { Point } from '../../core/types';
import { listMemories } from '../../db/memory';
import { listActivePoints } from '../../db/points';
import { recentReviews } from '../../db/reviewLog';
import type { Strings } from '../../i18n/strings';
import type { calmStudy } from '../../theme/calmStudy';
import { MemorySky } from './MemorySky';

type Colors = (typeof calmStudy)['light'] | (typeof calmStudy)['dark'];

interface Props {
  visible: boolean;
  hideText: boolean;
  t: Strings;
  colors: Colors;
  onClose: () => void;
}

interface Loaded {
  points: Point[];
  memories: Map<string, PointMemory>;
  run: number;
  now: Date;
}

export function SkyScreen({ visible, hideText, t, colors, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!visible) {
      setData(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const now = new Date();
      const [points, memories, log] = await Promise.all([listActivePoints(), listMemories(), recentReviews()]);
      if (!cancelled) setData({ points, memories, run: rhythm(log, now).run, now });
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        <Text style={[styles.heading, { color: colors.text }]}>{t.skyTitle}</Text>
        {data ? (
          <View style={styles.body}>
            <MemorySky points={data.points} memories={data.memories} now={data.now} t={t} colors={colors} hideText={hideText} />
            {data.run > 0 ? <Text style={{ color: colors.mutedText }}>{t.rhythmLine.replace('{n}', String(data.run))}</Text> : null}
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.close}
          onPress={onClose}
          style={[styles.close, { backgroundColor: colors.accent, marginBottom: insets.bottom + 16 }]}
        >
          <Text style={{ color: colors.onAccent, fontWeight: '600', fontSize: 16 }}>{t.close}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  heading: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  body: { flex: 1, alignItems: 'center', gap: 16 },
  close: { alignItems: 'center', paddingVertical: 14, borderRadius: 12 },
});
