// Your sky: one star per point. It grows each time the point comes back and never dims or shrinks.
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from './AppText';

import { layoutSky, totalAppearances } from '../core/sky';
import type { Point } from '../core/types';
import { fill, type Strings } from '../i18n/strings';
import { tint, type Theme } from '../theme/calmStudy';
import { Header } from './parts';

export function SkyScreen(props: { t: Strings; theme: Theme; points: Point[]; onBack: () => void }) {
  const { t, theme, points } = props;
  const { width } = useWindowDimensions();
  const side = Math.min(width - 32, 520);
  const stars = layoutSky(points);
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = points.find((p) => p.id === picked);

  return (
    <View style={[styles.wrap, { backgroundColor: theme.sky }]}>
      <Header title={t.skyTitle} backLabel={t.back} onBack={props.onBack} color={theme.star} titleColor={theme.star} />
      <Text style={styles.body}>{fill(t.skyBody, { n: totalAppearances(points) })}</Text>
      <View style={[styles.field, { width: side, height: side }]}>
        {stars.map((s) => {
          const d = 8 + 26 * s.size;
          const p = points.find((x) => x.id === s.pointId);
          return (
            <Pressable
              key={s.pointId}
              accessibilityRole="button"
              accessibilityLabel={fill(t.star, { n: p?.appearances ?? 0 })}
              onPress={() => setPicked(s.pointId)}
              hitSlop={8}
              style={[
                styles.star,
                { width: d, height: d, borderRadius: d / 2, left: s.x * side - d / 2, top: s.y * side - d / 2, backgroundColor: theme.star, borderWidth: 3, borderColor: p ? tint(theme, p.category) : theme.star, opacity: picked === s.pointId ? 1 : 0.85 },
              ]}
            />
          );
        })}
      </View>
      {chosen && (
        <Text accessibilityLiveRegion="polite" style={styles.picked}>
          {chosen.private ? t.privateTag : chosen.text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12, alignItems: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  title: { fontSize: 22, fontWeight: '700' },
  body: { color: '#D9DCF0', fontSize: 16, alignSelf: 'stretch' },
  field: { position: 'relative' },
  star: { position: 'absolute' },
  picked: { color: '#ECEAE4', fontSize: 17, lineHeight: 24, textAlign: 'center', paddingHorizontal: 8 },
});
