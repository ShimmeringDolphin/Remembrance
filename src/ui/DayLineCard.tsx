// Today as one line: a star for each reminder (filled once it has come, hollow while still to come), a bigger mark for now.
// Drawn when the screen is drawn; there is no timer, so the mark moves only when the app is opened or changed.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './AppText';

import type { DayLine } from '../core/dayline';
import { fill, type Strings } from '../i18n/strings';
import { tint, tintInk, type Theme } from '../theme/calmStudy';
import { clock } from './clock';
import { Card } from './parts';
import { Star } from './Star';

export function DayLineCard(props: { line: DayLine; t: Strings; theme: Theme }) {
  const { line, t, theme } = props;
  const [width, setWidth] = useState(0);
  const left = (frac: number, r: number) => 12 + frac * Math.max(0, width - 24) - (r + 2);
  const come = line.stars.filter((s) => s.past).length;
  const label = fill(t.dayLineA11y, { n: line.stars.length, m: line.stars.length - come });
  return (
    <Card theme={theme}>
      <View accessible accessibilityLabel={label}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{t.dayToday}</Text>
        <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <View style={[styles.thread, { backgroundColor: theme.thread }]} />
          {width > 0 &&
            line.stars.map((s, i) => (
              <View key={i} style={[styles.star, { left: left(s.frac, 6) }]}>
                <Star radius={6} color={tint(theme, 'daily')} outline={!s.past} />
              </View>
            ))}
          {width > 0 && (
            <View style={[styles.star, { left: left(line.now, 10) }]}>
              <Star radius={10} color={theme.text} />
            </View>
          )}
        </View>
        <View style={styles.times}>
          <Text style={[styles.time, { color: tintInk(theme, 'daily') }]}>{clock(line.first)}</Text>
          <Text style={[styles.time, { color: tintInk(theme, 'daily') }]}>{clock(line.last)}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700' },
  track: { height: 36, marginTop: 6, justifyContent: 'center' },
  thread: { position: 'absolute', left: 12, right: 12, height: 2, borderRadius: 1 },
  star: { position: 'absolute', top: 6 },
  times: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  time: { fontSize: 13 },
});
