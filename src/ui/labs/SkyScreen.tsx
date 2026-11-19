// Experimental (open-creativity): modal that shows Memory Sky and the gentle rhythm line.
// Loads points, memories and the recent log only while visible and drops them on close.
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { adviseOnPoints, hourlyEngagement, rhythm, suggestQuietHours, type PointAdvice } from '../../core/labs/insights';
import { retrievability, type PointMemory } from '../../core/labs/memory';
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
  advice: PointAdvice[];
  quiet: string[];
}

const MAX_ADVICE = 5;

export function SkyScreen({ visible, hideText, t, colors, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Loaded | null>(null);
  const [view, setView] = useState<'sky' | 'list'>('sky');

  useEffect(() => {
    if (!visible) {
      setData(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const now = new Date();
      const [points, memories, log] = await Promise.all([listActivePoints(), listMemories(), recentReviews()]);
      if (!cancelled) setData({
          points,
          memories,
          run: rhythm(log, now).run,
          now,
          advice: adviseOnPoints(points, memories).slice(0, MAX_ADVICE),
          quiet: suggestQuietHours(hourlyEngagement(log)).map((r) => `${r.start}-${r.end}`),
        });
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        <Text style={[styles.heading, { color: colors.text }]}>{t.skyTitle}</Text>
        <View style={styles.tabs}>
          {(['sky', 'list'] as const).map((v) => (
            <Pressable
              key={v}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === v }}
              onPress={() => setView(v)}
              style={[styles.tab, { borderColor: colors.accent, backgroundColor: view === v ? colors.accent : 'transparent' }]}
            >
              <Text style={{ color: view === v ? colors.onAccent : colors.accent }}>{v === 'sky' ? t.viewSky : t.viewList}</Text>
            </Pressable>
          ))}
        </View>
        {data && view === 'list' ? (
          <FlatList
            style={styles.scroll}
            data={[...data.points].sort(
              (a, b) =>
                (data.memories.has(a.id) ? retrievability(data.memories.get(a.id)!, data.now) : 0.6) -
                (data.memories.has(b.id) ? retrievability(data.memories.get(b.id)!, data.now) : 0.6),
            )}
            keyExtractor={(p) => p.id}
            ListEmptyComponent={<Text style={{ color: colors.mutedText }}>{t.skyEmpty}</Text>}
            renderItem={({ item }) => {
              const m = data.memories.get(item.id);
              const recall = t.skyRecall.replace('{n}', String(Math.round((m ? retrievability(m, data.now) : 0.6) * 100)));
              return (
                <View style={[styles.row, { borderColor: colors.mutedText }]} accessible accessibilityLabel={hideText ? recall : `${item.prompt}, ${recall}`}>
                  {hideText ? null : <Text style={[styles.rowText, { color: colors.text }]}>{item.prompt}</Text>}
                  <Text style={{ color: colors.mutedText }}>{recall}</Text>
                </View>
              );
            }}
          />
        ) : null}
        {data && view === 'sky' ? (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
            <MemorySky points={data.points} memories={data.memories} now={data.now} t={t} colors={colors} hideText={hideText} />
            {data.run > 0 ? <Text style={{ color: colors.mutedText }}>{t.rhythmLine.replace('{n}', String(data.run))}</Text> : null}
            {data.quiet.map((range) => (
              <Text key={range} style={[styles.advice, { color: colors.text }]}>
                {t.adviceQuiet.replace('{range}', range)}
              </Text>
            ))}
            {hideText
              ? null
              : data.advice.map((a) => {
                  const point = data.points.find((p) => p.id === a.pointId);
                  const message = a.kind === 'reword' ? t.adviceReword : a.kind === 'gentler' ? t.adviceGentler : t.adviceGraduate;
                  return point ? (
                    <Text key={a.pointId} style={[styles.advice, { color: colors.text }]}>
                      <Text style={{ fontWeight: '600' }}>{point.prompt}</Text> {message}
                    </Text>
                  ) : null;
                })}
          </ScrollView>
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
  scroll: { flex: 1 },
  tabs: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  tab: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 18, justifyContent: 'center' },
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  rowText: { fontSize: 17, lineHeight: 24 },
  body: { alignItems: 'center', gap: 16, paddingBottom: 16 },
  advice: { alignSelf: 'stretch', fontSize: 15, lineHeight: 22 },
  close: { alignItems: 'center', paddingVertical: 14, borderRadius: 12 },
});
