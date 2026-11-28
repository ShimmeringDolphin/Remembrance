// Your sky: one star per point. It grows each time the point comes back and never dims or shrinks.
// Thin lines join the stars of one category. Drawn once, no animation.
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Polygon, Polyline } from 'react-native-svg';
import { PointText, Text } from './AppText';

import { layoutSky, skyThreads, totalAppearances } from '../core/sky';
import { starPoints } from '../core/star';
import type { Point } from '../core/types';
import { fill, type Strings } from '../i18n/strings';
import { tint, type Theme } from '../theme/calmStudy';
import { Header } from './parts';

/** A few faint dots behind the stars, in fixed places so the sky never shifts. */
const DOTS = Array.from({ length: 16 }, (_, i) => ({ x: ((i * 37) % 97) / 97, y: ((i * 61 + 13) % 89) / 89, r: 0.8 + (i % 3) * 0.4 }));

export function SkyScreen(props: { t: Strings; theme: Theme; points: Point[]; onBack: () => void }) {
  const { t, theme, points } = props;
  const { width } = useWindowDimensions();
  const side = Math.min(width - 32, 520);
  const stars = layoutSky(points);
  const byId = new Map(points.map((p) => [p.id, p]));
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = picked ? byId.get(picked) : undefined;
  const radius = (size: number) => 4 + 13 * size;
  const at = (id: string) => stars.find((s) => s.pointId === id)!;
  const came = (p: Point) => (p.appearances === 0 ? t.appearedNone : p.appearances === 1 ? t.appearedOnce : fill(t.appeared, { n: p.appearances }));

  return (
    <View style={[styles.wrap, { backgroundColor: theme.sky }]}>
      <Header title={t.skyTitle} backLabel={t.back} onBack={props.onBack} color={theme.skyHead} titleColor={theme.skyHead} />
      <Text style={[styles.body, { color: theme.skyText }]}>{fill(t.skyBody, { n: totalAppearances(points) })}</Text>
      <View style={{ width: side, height: side }}>
        <Svg width={side} height={side} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {DOTS.map((d, i) => (
            <Circle key={i} cx={d.x * side} cy={d.y * side} r={d.r} fill={theme.skyText} opacity={0.25} />
          ))}
          {skyThreads(stars, points).map((th) => (
            <Polyline
              key={th.category}
              points={th.ids.map((id) => `${at(id).x * side},${at(id).y * side}`).join(' ')}
              fill="none"
              stroke={tint(theme, th.category)}
              strokeWidth={1}
              opacity={0.55}
            />
          ))}
          {stars.map((s) => {
            const p = byId.get(s.pointId);
            return (
              <Polygon
                key={s.pointId}
                points={starPoints(s.x * side, s.y * side, radius(s.size))}
                fill={theme.star}
                stroke={p ? tint(theme, p.category) : theme.star}
                strokeWidth={picked === s.pointId ? 3 : 1.5}
                strokeLinejoin="round"
                opacity={picked === null || picked === s.pointId ? 1 : 0.8}
              />
            );
          })}
        </Svg>
        {stars.map((s) => {
          const p = byId.get(s.pointId);
          const d = Math.max(44, radius(s.size) * 2 + 8);
          return (
            <Pressable
              key={s.pointId}
              accessibilityRole="button"
              accessibilityLabel={fill(t.star, { n: p?.appearances ?? 0 })}
              onPress={() => setPicked(s.pointId)}
              style={[styles.hit, { width: d, height: d, left: s.x * side - d / 2, top: s.y * side - d / 2 }]}
            />
          );
        })}
      </View>
      {chosen ? (
        <View accessibilityLiveRegion="polite" style={[styles.card, { backgroundColor: theme.skyCard }]}>
          <Text style={[styles.cardMeta, { color: tint(theme, chosen.category) }]}>
            {(chosen.category === 'daily' ? t.daily : t.longTerm) + ' · ' + fill(t.skySince, { date: new Date(chosen.createdAt).toLocaleDateString(t.locale, { day: 'numeric', month: 'long' }) })}
          </Text>
          <PointText style={[styles.cardText, { color: theme.skyHead }]}>{chosen.private ? t.privatePoint : chosen.text}</PointText>
          <Text style={[styles.cardMeta, { color: theme.skyText }]}>{came(chosen)}</Text>
        </View>
      ) : (
        <Text style={[styles.hint, { color: theme.skyText }]}>{t.skyHint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12, alignItems: 'center' },
  body: { fontSize: 16, alignSelf: 'stretch' },
  hit: { position: 'absolute' },
  hint: { fontSize: 15, textAlign: 'center', paddingHorizontal: 8, marginTop: 'auto' },
  card: { alignSelf: 'stretch', borderRadius: 18, padding: 16, gap: 6, marginTop: 'auto' },
  cardMeta: { fontSize: 14, fontWeight: '600' },
  cardText: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
});
