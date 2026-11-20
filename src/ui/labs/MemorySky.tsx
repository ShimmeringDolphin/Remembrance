// Experimental (open-creativity): the "Memory Sky" view. Each point is a star; brightness is the
// chance it can still be recalled. Static render: no animation loop, no timers. Draws at most
// MAX_STARS (60) plain Views. Not run on a device yet.
import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { layoutSky } from '../../core/labs/sky';
import { retrievability, type PointMemory } from '../../core/labs/memory';
import type { Point } from '../../core/types';
import type { Strings } from '../../i18n/strings';

interface Colors {
  background: string;
  text: string;
  mutedText: string;
  accent: string;
}

interface Props {
  points: readonly Point[];
  memories: ReadonlyMap<string, PointMemory>;
  /** Evaluated once per render; pass a new Date when the screen is shown. */
  now: Date;
  t: Strings;
  colors: Colors;
  /** Hide point text when private mode is on; stars still show. */
  hideText: boolean;
  onSelect?: (pointId: string) => void;
}

const SIZE = 320;

function MemorySkyView({ points, memories, now, t, colors, hideText, onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const stars = useMemo(() => layoutSky(points), [points]);
  const byId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);
  const chosen = selected ? byId.get(selected) : undefined;
  const chosenMemory = selected ? memories.get(selected) : undefined;
  const chosenRecall = chosenMemory ? Math.round(retrievability(chosenMemory, now) * 100) : 60;

  if (stars.length === 0) return <Text style={{ color: colors.mutedText }}>{t.skyEmpty}</Text>;

  return (
    <View style={styles.wrap}>
      <View style={[styles.sky, { backgroundColor: colors.background, borderColor: colors.mutedText }]}>
        {stars.map((s) => {
          const mem = memories.get(s.pointId);
          const r = mem ? retrievability(mem, now) : 0.6;
          const glow = 16 + 36 * r;
          const label = hideText ? t.skyRecall.replace('{n}', String(Math.round(r * 100))) : `${byId.get(s.pointId)?.prompt ?? ''}, ${Math.round(r * 100)}%`;
          return (
            <Pressable
              key={s.pointId}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => {
                setSelected(s.pointId);
                onSelect?.(s.pointId);
              }}
              style={[styles.hit, { left: s.x * SIZE - 22, top: s.y * SIZE - 22 }]}
            >
              <View
                style={{
                  width: glow,
                  height: glow,
                  borderRadius: glow / 2,
                  backgroundColor: colors.accent,
                  opacity: 0.1 + 0.3 * r,
                  position: 'absolute',
                }}
              />
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, opacity: 0.35 + 0.65 * r }} />
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: colors.mutedText }]}>{t.skyHint}</Text>
      {chosen ? (
        <Text style={{ color: colors.text, fontSize: 16 }}>
          {hideText ? '' : `${chosen.prompt}  `}
          <Text style={{ color: colors.mutedText }}>{t.skyRecall.replace('{n}', String(chosenRecall))}</Text>
        </Text>
      ) : null}
    </View>
  );
}

export const MemorySky = memo(MemorySkyView);

const styles = StyleSheet.create({
  wrap: { gap: 12, alignItems: 'center' },
  sky: { width: SIZE, height: SIZE, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  hit: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 13 },
});
