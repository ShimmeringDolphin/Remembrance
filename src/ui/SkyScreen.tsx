import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layoutSky, totalAppearances } from '../core/sky';
import type { Point } from '../core/types';
import { listActivePoints } from '../db/points';
import type { Strings } from '../i18n/strings';
import type { calmStudy } from '../theme/calmStudy';

type Colors = (typeof calmStudy)['light'] | (typeof calmStudy)['dark'];

interface Props {
  visible: boolean;
  /** Private mode: stars still show, but no point text, even for screen readers. */
  hideText: boolean;
  t: Strings;
  colors: Colors;
  onClose: () => void;
}

const SIZE = 320;
const MAX_GLOW = 54;

/**
 * Every point is a star that grows each time it appears. Nothing to do and nothing to lose.
 * Static: plain Views, no animation loop, no timers; data is loaded on open and dropped on close.
 */
export function SkyScreen({ visible, hideText, t, colors, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [points, setPoints] = useState<Point[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setPoints([]);
      setSelected(null);
      return;
    }
    let cancelled = false;
    void listActivePoints().then((rows) => {
      if (!cancelled) setPoints(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const stars = useMemo(() => layoutSky(points), [points]);
  const byId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);
  const total = totalAppearances(points);
  const label = (p: Point) =>
    hideText
      ? t.starPrivate.replace('{n}', String(p.timesShown))
      : t.starLabel.replace('{point}', p.prompt).replace('{n}', String(p.timesShown));
  const chosen = selected ? byId.get(selected) : undefined;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Text style={[styles.heading, { color: colors.text }]} accessibilityRole="header">
          {t.skyTitle}
        </Text>
        <Text style={[styles.line, { color: colors.text }]}>{t.skyLine.replace('{n}', String(total))}</Text>
        <View style={[styles.sky, { borderColor: colors.mutedText }]}>
          {stars.map((s) => {
            const p = byId.get(s.pointId);
            if (!p) return null;
            const glow = MAX_GLOW * s.size;
            return (
              <Pressable
                key={s.pointId}
                accessibilityRole="button"
                accessibilityLabel={label(p)}
                onPress={() => setSelected(s.pointId)}
                style={[styles.hit, { left: s.x * SIZE - 22, top: s.y * SIZE - 22 }]}
              >
                <View style={{ position: 'absolute', width: glow, height: glow, borderRadius: glow / 2, backgroundColor: colors.accent, opacity: 0.12 + 0.2 * s.size }} />
                <View
                  style={{
                    width: 4 + 6 * s.size,
                    height: 4 + 6 * s.size,
                    borderRadius: 5,
                    backgroundColor: colors.accent,
                    opacity: 0.5 + 0.5 * s.size,
                    borderWidth: selected === s.pointId ? 2 : 0,
                    borderColor: colors.text,
                  }}
                />
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: colors.mutedText }]}>{chosen ? label(chosen) : t.skyHint}</Text>
        <View style={styles.spacer} />
        <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose} style={[styles.close, { backgroundColor: colors.accent }]}>
          <Text style={{ color: colors.onAccent, fontWeight: '600', fontSize: 16 }}>{t.close}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, alignItems: 'center', gap: 14 },
  heading: { fontSize: 24, fontWeight: '600', alignSelf: 'flex-start' },
  line: { fontSize: 17, lineHeight: 24, alignSelf: 'flex-start' },
  sky: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  hit: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 15, lineHeight: 22, textAlign: 'center', minHeight: 44 },
  spacer: { flex: 1 },
  close: { alignSelf: 'stretch', minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
