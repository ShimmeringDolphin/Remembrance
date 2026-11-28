// A moment: the points of one reminder, one at a time, in their category's colour.
// Nothing to mark or answer. The last view shows those points' stars growing a little.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { PointText, Text } from './AppText';

import { lastDayOf, sameDay } from '../core/expiry';
import { starGrowth } from '../core/moment';
import { layoutSky } from '../core/sky';
import type { Language, Point } from '../core/types';
import { fill, type Strings } from '../i18n/strings';
import { missingVoices, say, speechDown, stopAll } from '../notify/voice';
import { onTint, tint, tintInk, tintSoft, type Theme } from '../theme/calmStudy';
import { Star } from './Star';

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
  // Next fills from the left during the wait, on the graphics side (no extra timer); with reduced motion it just stays dim.
  const fill_ = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setReady(false);
    fill_.setValue(0);
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!cancelled && !reduce) Animated.timing(fill_, { toValue: 1, duration: READ_DELAY_MS, useNativeDriver: true }).start();
      });
    const timer = setTimeout(() => setReady(true), READ_DELAY_MS);
    return () => {
      cancelled = true;
      fill_.stopAnimation();
      clearTimeout(timer);
    };
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

  const last_ = lastDayOf(p.expiresAt);
  const label = p.category === 'daily' ? (last_ && sameDay(last_, new Date()) ? `${t.daily}, ${t.lastDayToday.toLowerCase()}` : t.daily) : t.longTerm;
  const came = p.appearances === 0 ? t.appearedNone : p.appearances === 1 ? t.appearedOnce : fill(t.appeared, { n: p.appearances });

  return (
    <View style={[styles.wrap, { backgroundColor: tintSoft(theme, p.category) }]}>
      <View style={styles.top}>
        <Text style={[styles.chip, { backgroundColor: colour, color: onTint(theme, p.category) }]}>{label}</Text>
        <Text style={[styles.count, { color: theme.cardText }]}>{fill(t.momentOf, { i: i + 1, n: moment.length })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={props.onClose} hitSlop={12}>
          <Text style={[styles.close, { color: theme.cardText }]}>✕</Text>
        </Pressable>
      </View>
      <View style={styles.starRow} accessible accessibilityLabel={fill(t.momentOf, { i: i + 1, n: moment.length })}>
        <View style={[styles.starThread, { backgroundColor: colour }]} />
        {moment.map((m, k) => (
          <View key={m.id} style={[styles.starSlot, { backgroundColor: tintSoft(theme, p.category) }]}>
            <Star radius={k === i ? 11 : 7} color={colour} outline={k > i} />
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={p.text} accessibilityHint={t.next} onPress={next} style={styles.textBox}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <PointText key={p.id} style={[styles.text, { color: theme.cardText }]}>{p.text}</PointText>
          <Text style={[styles.came, { color: theme.muted }]}>{came}</Text>
        </View>
      </Pressable>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={speaking ? t.reading : t.readAloud}
          accessibilityState={{ busy: speaking }}
          onPress={toggleVoice}
          style={[styles.round, { backgroundColor: speaking ? colour : theme.surface, borderColor: colour }]}
        >
          <Svg width={26} height={26} viewBox="0 0 24 24">
            {speaking ? (
              <Rect x={7} y={7} width={10} height={10} rx={2} fill={onTint(theme, p.category)} />
            ) : (
              <>
                <Path d="M4 9v6h4l5 4V5L8 9H4z" fill={tintInk(theme, p.category)} />
                <Path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" fill="none" stroke={tintInk(theme, p.category)} strokeWidth={2} strokeLinecap="round" />
              </>
            )}
          </Svg>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={last ? t.done : t.next}
          accessibilityState={{ disabled: !canNext }}
          disabled={!canNext}
          onPress={next}
          style={[styles.btn, styles.nextBtn, { backgroundColor: canNext ? theme.cardText : theme.surface, borderColor: theme.cardText }]}
        >
          {!canNext && <Animated.View style={[styles.fillBar, { backgroundColor: theme.cardText, transform: [{ scaleX: fill_ }] }]} />}
          <Text style={[styles.btnText, { color: canNext ? tintSoft(theme, p.category) : theme.cardText }]}>{i < moment.length - 1 ? t.next : t.done}</Text>
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
  const side = Math.min(width - 48, 300);
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
    <View style={[styles.wrap, { backgroundColor: theme.background, alignItems: 'center' }]}>
      <Text accessibilityRole="header" style={[styles.grewTitle, { color: theme.text }]}>{title}</Text>
      <View style={{ width: side, height: side, backgroundColor: theme.sky, borderRadius: 20 }}>
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
                  left: s.x * side - full / 2,
                  top: s.y * side - full / 2,
                  opacity: mine ? 1 : 0.45,
                  transform: [{ scale }],
                },
              ]}
            >
              <Star radius={full / 2 - 2} color={theme.star} stroke={mine ? tint(theme, p.category) : theme.star} strokeWidth={mine ? 2.5 : 1} />
            </Animated.View>
          );
        })}
      </View>
      <View style={styles.list}>
        {moment.map((m) => (
          <View key={m.id} style={[styles.listRow, { backgroundColor: theme.surface }]}>
            <Star radius={7} color={tint(theme, m.category)} />
            <PointText style={[styles.listText, { color: theme.text }]}>{m.private ? t.privatePoint : m.text}</PointText>
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t.done} onPress={props.onClose} style={[styles.btn, styles.back, { backgroundColor: theme.button, borderColor: theme.button }]}>
        <Text style={[styles.btnText, { color: theme.onButton }]}>{t.done}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, fontSize: 14, fontWeight: '700', overflow: 'hidden' },
  count: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600' },
  starRow: { height: 30, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  starThread: { position: 'absolute', left: 0, right: 0, height: 2, borderRadius: 1, opacity: 0.5 },
  starSlot: { paddingHorizontal: 6 },
  card: { borderRadius: 18, padding: 22, gap: 12 },
  came: { fontSize: 14 },
  round: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  nextBtn: { overflow: 'hidden' },
  fillBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', opacity: 0.22, transformOrigin: 'left' },
  close: { fontSize: 20, paddingHorizontal: 4 },
  textBox: { flex: 1, justifyContent: 'center', paddingHorizontal: 8 },
  text: { fontSize: 28, lineHeight: 38, fontWeight: '700', textAlign: 'left' },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, minHeight: 52, borderRadius: 26, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnText: { fontSize: 16, fontWeight: '700' },
  small: { fontSize: 13, textAlign: 'center', opacity: 0.7 },
  grewTitle: { fontSize: 24, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  star: { position: 'absolute' },
  back: { flex: 0, alignSelf: 'stretch', marginTop: 'auto' },
  list: { alignSelf: 'stretch', gap: 6 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  listText: { flex: 1, fontSize: 15 },
});
