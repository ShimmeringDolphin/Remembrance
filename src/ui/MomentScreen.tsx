// A moment: the points of one reminder, one at a time, in their category's colour.
// Nothing to mark or answer. The last view shows those points' stars growing a little.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { PointText, Text } from './AppText';

import { starGrowth } from '../core/moment';
import { layoutSky } from '../core/sky';
import type { Language, Point } from '../core/types';
import { fill, type Strings } from '../i18n/strings';
import { missingVoices, say, speechDown, stopAll } from '../notify/voice';
import { onTint, tint, tintInk, tintSoft, type Theme } from '../theme/calmStudy';

interface Props {
  t: Strings;
  theme: Theme;
  language: Language;
  moment: Point[];
  allPoints: Point[];
  readAloud: boolean;
  onClose: () => void;
}

/** How long Next and Done stay unavailable on each point of a moment (longer if the voice is still reading it). */
const READ_DELAY_MS = 5000;

export function MomentScreen(props: Props) {
  const { t, theme, moment } = props;
  const [i, setI] = useState(0);
  const [spoke, setSpoke] = useState(false);
  const done = i >= moment.length;
  const p = moment[Math.min(i, moment.length - 1)];
  const last = i === moment.length - 1;
  // Next and Done wait a few seconds on every point, so no point is skipped before it is read.
  // One timeout per point, cleared when the point changes or the screen closes.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const timer = setTimeout(() => setReady(true), READ_DELAY_MS);
    return () => clearTimeout(timer);
  }, [i]);

  // The button plays the card once. While it plays the button says so, and it goes back to "Read aloud" by itself
  // when the voice ends or is stopped. A newer play or a new card makes an older ending count for nothing.
  const [speaking, setSpeaking] = useState(false);
  const playRun = useRef(0);
  const play = () => {
    if (!p) return;
    const run = ++playRun.current;
    setSpoke(true);
    setSpeaking(true);
    say(p, props.language, () => {
      if (playRun.current === run) setSpeaking(false);
    });
  };
  // With the Settings switch on, each card is read as it appears. Private points are only read from a tap.
  useEffect(() => {
    setSpeaking(false);
    if (!done && p && props.readAloud && !p.private) play();
    return () => {
      playRun.current++;
      stopAll();
    };
  }, [i, done, props.readAloud]);

  // Tell the user once per card, in the card itself, when the phone has no voice for a language in it.
  const [missing, setMissing] = useState<Language[]>([]);
  const [down, setDown] = useState(false);
  useEffect(() => {
    let alive = true;
    setMissing([]);
    setDown(false);
    if (!done && p && (props.readAloud || spoke) && !p.voice) {
      void speechDown().then((d) => {
        if (!alive) return;
        setDown(d);
        if (!d) void missingVoices(p.text, props.language).then((m) => alive && setMissing(m));
      });
    }
    return () => {
      alive = false;
    };
  }, [i, done, props.readAloud, spoke]);

  if (moment.length === 0) return null;
  if (done) return <Grew {...props} />;

  const colour = tint(theme, p.category);
  // Next waits for both: the few seconds, and the voice finishing if it is reading this card.
  const canNext = ready && !speaking;
  const next = () => {
    if (!canNext) return;
    stopAll();
    setI((n) => n + 1);
  };
  // Tap to read the card; tap again while it is being read to stop.
  const toggleVoice = () => {
    if (speaking) {
      playRun.current++;
      setSpeaking(false);
      stopAll();
    } else play();
  };

  return (
    <View style={[styles.wrap, { backgroundColor: tintSoft(theme, p.category) }]}>
      <View style={styles.top}>
        <Text style={[styles.chip, { backgroundColor: colour, color: onTint(theme, p.category) }]}>{p.category === 'daily' ? t.daily : t.longTerm}</Text>
        <View style={styles.bars} accessible accessibilityLabel={fill(t.momentOf, { i: i + 1, n: moment.length })}>
          {moment.map((m, k) => (
            <View key={m.id} style={[styles.bar, { backgroundColor: k <= i ? colour : theme.line }]} />
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={props.onClose} hitSlop={12}>
          <Text style={[styles.close, { color: theme.cardText }]}>✕</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={p.text} accessibilityHint={t.next} onPress={next} style={styles.textBox}>
        <PointText key={p.id} style={[styles.text, { color: theme.cardText }]}>{p.text}</PointText>
      </Pressable>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={speaking ? t.reading : t.readAloud}
          accessibilityState={{ busy: speaking }}
          onPress={toggleVoice}
          style={[styles.btn, { backgroundColor: speaking ? colour : theme.surface, borderColor: colour }]}
        >
          <Text style={[styles.btnText, { color: speaking ? onTint(theme, p.category) : tintInk(theme, p.category) }]}>{speaking ? t.reading : t.readAloud}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={last ? t.done : t.next}
          accessibilityState={{ disabled: !canNext }}
          disabled={!canNext}
          onPress={next}
          style={[styles.btn, { backgroundColor: theme.cardText, borderColor: theme.cardText, opacity: canNext ? 1 : 0.35 }]}
        >
          <Text style={[styles.btnText, { color: tintSoft(theme, p.category) }]}>{i < moment.length - 1 ? t.next : t.done}</Text>
        </Pressable>
      </View>
      {down && (
        <Text style={[styles.small, { color: theme.cardText }]} accessibilityLiveRegion="polite">
          {t.speechDown}
        </Text>
      )}
      {missing.length > 0 && (
        <Text style={[styles.small, { color: theme.cardText }]} accessibilityLiveRegion="polite">
          {fill(t.voiceMissing, { lang: missing.map((l) => (l === 'hi' ? t.langHindi : l === 'gu' ? t.langGujarati : t.langEnglish)).join(', ') })}
        </Text>
      )}
      <Text style={[styles.small, { color: theme.cardText }]}>{canNext ? t.tapNext : t.readWait}</Text>
    </View>
  );
}

/** The end of a moment: every star, with this moment's stars growing from their old size. */
function Grew(props: Props) {
  const { t, theme, moment, allPoints } = props;
  const { width } = useWindowDimensions();
  const side = Math.min(width - 48, 420);
  const grow = useRef(new Animated.Value(0)).current;
  const ids = new Set(moment.map((m) => m.id));
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) grow.setValue(1);
        else Animated.timing(grow, { toValue: 1, duration: 1400, delay: 250, useNativeDriver: true }).start();
      });
    return () => {
      cancelled = true;
      grow.stopAnimation();
    };
  }, [grow]);
  const stars = layoutSky(allPoints);
  const byId = new Map(allPoints.map((p) => [p.id, p]));
  const title = moment.length === 1 ? t.starGrewOne : fill(t.starsGrew, { n: moment.length });

  return (
    <View style={[styles.wrap, { backgroundColor: theme.sky, alignItems: 'center' }]}>
      <Text accessibilityRole="header" style={[styles.grewTitle, { color: theme.star }]}>{title}</Text>
      <View style={{ width: side, height: side }}>
        {stars.map((s) => {
          const p = byId.get(s.pointId);
          if (!p) return null;
          const mine = ids.has(p.id);
          const g = starGrowth(p);
          const full = 10 + 30 * (mine ? g.to : s.size);
          const scale = mine ? grow.interpolate({ inputRange: [0, 1], outputRange: [(10 + 30 * g.from) / full, 1] }) : 1;
          return (
            <Animated.View
              key={s.pointId}
              style={[
                styles.star,
                {
                  width: full,
                  height: full,
                  borderRadius: full / 2,
                  left: s.x * side - full / 2,
                  top: s.y * side - full / 2,
                  backgroundColor: theme.star,
                  borderColor: tint(theme, p.category),
                  opacity: mine ? 1 : 0.45,
                  transform: [{ scale }],
                },
              ]}
            />
          );
        })}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t.backToPoints} onPress={props.onClose} style={[styles.btn, styles.back, { borderColor: theme.skyText }]}>
        <Text style={[styles.btnText, { color: theme.star }]}>{t.backToPoints}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, fontSize: 14, fontWeight: '700', overflow: 'hidden' },
  bars: { flex: 1, flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  close: { fontSize: 20, paddingHorizontal: 4 },
  textBox: { flex: 1, justifyContent: 'center', paddingHorizontal: 8 },
  text: { fontSize: 30, lineHeight: 40, fontWeight: '700', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnText: { fontSize: 16, fontWeight: '700' },
  small: { fontSize: 13, textAlign: 'center', opacity: 0.7 },
  grewTitle: { fontSize: 24, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  star: { position: 'absolute', borderWidth: 3 },
  back: { flex: 0, alignSelf: 'stretch', marginTop: 'auto' },
});
