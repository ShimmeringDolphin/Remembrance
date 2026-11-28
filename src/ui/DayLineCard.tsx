// Today as one line: a star for each reminder (filled once it has come, hollow while still to come), a bigger mark for now.
// Drawn when the screen is drawn; there is no timer, so the mark moves only when the app is opened or changed.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './AppText';

import type { DayLine, DayStrip } from '../core/dayline';
import { starRadius } from '../core/star';
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
  // Many reminders a day (every 15 minutes): smaller stars so they stay apart.
  const r = starRadius(width - 24, line.stars.length, 6);
  const label = fill(t.dayLineA11y, { n: line.stars.length, m: line.stars.length - come });
  return (
    <Card theme={theme}>
      <View accessible accessibilityLabel={label}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{t.dayToday}</Text>
        <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <View style={[styles.thread, { backgroundColor: theme.thread }]} />
          {width > 0 &&
            line.stars.map((s, i) => (
              <View key={i} style={[styles.star, { left: left(s.frac, r), top: 18 - (r + 2) }]}>
                <Star radius={r} color={tint(theme, 'daily')} outline={!s.past} />
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
  strip: { height: 28, marginTop: 8, justifyContent: 'center' },
  quiet: { position: 'absolute', top: 2, bottom: 2, borderRadius: 6 },
  summary: { fontSize: 14, marginTop: 6 },
});

/** Settings: a midnight-to-midnight line with a star for each planned reminder and the quiet hours shaded. */
export function DayStripCard(props: { strip: DayStrip; summary: string; t: Strings; theme: Theme }) {
  const { strip, summary, t, theme } = props;
  const [width, setWidth] = useState(0);
  const usable = Math.max(0, width - 16);
  const at = (frac: number) => 8 + frac * usable;
  const marks = [0, 6, 12, 18, 24];
  const r = starRadius(usable, strip.stars.length, 5);
  return (
    <Card theme={theme}>
      <View accessible accessibilityLabel={`${t.yourDay}. ${summary}`}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{t.yourDay}</Text>
        <View style={styles.strip} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 &&
            strip.quiet.map((q, i) => (
              <View key={i} style={[styles.quiet, { left: at(q.from), width: Math.max(2, (q.to - q.from) * usable), backgroundColor: theme.chip }]} />
            ))}
          <View style={[styles.thread, { backgroundColor: theme.thread }]} />
          {width > 0 &&
            strip.stars.map((f, i) => (
              <View key={i} style={[styles.star, { left: at(f) - (r + 2), top: 14 - (r + 2) }]}>
                <Star radius={r} color={tint(theme, 'daily')} />
              </View>
            ))}
        </View>
        <View style={styles.times}>
          {marks.map((h) => (
            <Text key={h} style={[styles.time, { color: theme.muted }]}>{clock(new Date(2000, 0, 1, h % 24))}</Text>
          ))}
        </View>
        <Text style={[styles.summary, { color: theme.muted }]}>{summary}</Text>
      </View>
    </Card>
  );
}
