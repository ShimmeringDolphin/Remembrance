// The notebook: Awake/Asleep, a box to add a point, then the points in their colours.
// Nothing to tick off and no counts to keep up. Points from the latest reminder glow for a while.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, SectionList, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { PointText, Text, TextInput } from './AppText';

import { paceFor } from '../core/pace';
import { DEFAULT_DAILY_DAYS, lastDayOf, MAX_DAILY_DAYS, sameDay } from '../core/expiry';
import { MAX_PER_CATEGORY, MAX_TEXT_LENGTH, cleanText } from '../core/limits';
import { homeRadius } from '../core/star';
import { starSize } from '../core/sky';
import { dayLine } from '../core/dayline';
import type { Category, Point, Settings } from '../core/types';
import { fill, type Strings } from '../i18n/strings';
import type { Permission } from '../notify/reminders';
import { onTint, tint, tintInk, tintSoft, type Theme } from '../theme/calmStudy';
import { OverflowMenu } from './OverflowMenu';
import { SkyMark } from './SkyMark';
import type { Status } from '../core/awake';
import { clock } from './clock';
import { nextTip, type TipId, type TipState } from '../core/tips';
import { TipCard } from './TipCard';
import { Button, Card, Choice } from './parts';
import { DayLineCard } from './DayLineCard';
import { Star } from './Star';

interface Props {
  t: Strings;
  theme: Theme;
  points: Point[];
  asleep: boolean;
  settings: Settings;
  fresh: Set<string>;
  skyOpen: boolean;
  batteryTip: boolean;
  listening: boolean;
  permission: Permission;
  onAdd: (text: string, category: Category, days: number) => Promise<boolean>;
  onOpen: (id: string) => void;
  onSettings: () => void;
  onHelp: () => void;
  onSky: () => void;
  onAsleep: (asleep: boolean) => void;
  /** What reminders are doing right now, for the line under the buttons. */
  status: Status;
  onTurnOn: () => void;
  onBatteryTip: (open: boolean) => void;
  /** Reminders were seen arriving late: say what to change. */
  lateTip: boolean;
  samsung: boolean;
  onLateTip: (open: boolean) => void;
  onLatestMoment: () => void;
  /** The latest reminder has not been gone through yet. */
  latestNew: boolean;
  onListen: () => void;
  /** The first-run tips: what has been seen, and a tap on OK or Skip tips. */
  tips: TipState;
  onTip: (action: 'got' | 'skip', id: TipId) => void;
}

type Section = { key: string; title: string; hint?: string; category?: Category; data: Point[] };

export function Home(props: Props) {
  const { t, theme, points } = props;
  const [text, setText] = useState('');
  const [category, setCategory] = useState<Category>('daily');
  const [days, setDays] = useState(DEFAULT_DAILY_DAYS);
  const [full, setFull] = useState(false);
  const [showAway, setShowAway] = useState(false);
  const [daysOpen, setDaysOpen] = useState(false);

  const sections = useMemo<Section[]>(() => {
    const live = points.filter((p) => !p.archived);
    const away = points.filter((p) => p.archived);
    const out: Section[] = [
      { key: 'daily', title: t.daily, hint: t.dailyHint, category: 'daily', data: live.filter((p) => p.category === 'daily') },
      { key: 'long_term', title: t.longTerm, hint: t.longTermHint, category: 'long_term', data: live.filter((p) => p.category === 'long_term') },
    ];
    if (away.length > 0) out.push({ key: 'away', title: fill(t.putAwaySection, { n: away.length }), data: showAway ? away : [] });
    return out;
  }, [points, showAway, t]);

  const list = useRef<SectionList<Point, Section>>(null);
  // After Keep it: the ids already there, so the list can scroll to the new point once it shows up.
  const added = useRef<{ before: Set<string> } | null>(null);
  useEffect(() => {
    if (!added.current) return;
    const fresh = points.find((p) => !p.archived && !added.current!.before.has(p.id));
    if (!fresh) return;
    added.current = null;
    const sectionIndex = sections.findIndex((s) => s.key === fresh.category);
    const itemIndex = sectionIndex < 0 ? -1 : sections[sectionIndex].data.findIndex((p) => p.id === fresh.id);
    if (itemIndex >= 0) list.current?.scrollToLocation({ sectionIndex, itemIndex, viewPosition: 0.5, animated: true });
  }, [points, sections]);

  const clean = cleanText(text);
  const add = async () => {
    if (!clean) return;
    Keyboard.dismiss();
    added.current = { before: new Set(points.map((p) => p.id)) };
    const ok = await props.onAdd(clean, category, days);
    setFull(!ok);
    if (ok) {
      setText('');
      setDays(DEFAULT_DAILY_DAYS);
    } else {
      added.current = null;
    }
  };
  const hasLive = points.some((p) => !p.archived);
  const today = new Date();
  const lastDay = (expiresAt: string | null) => {
    const d = lastDayOf(expiresAt);
    if (!d) return null;
    const text = sameDay(d, today)
      ? t.lastDayToday
      : fill(t.lastDayOn, { date: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) });
    return <Text style={[styles.tag, { color: tintInk(theme, 'daily') }]}>{text}</Text>;
  };

  // One tip at a time, only once there is a point, and never on top of the other notes on this screen.
  const showLatest = props.fresh.size > 0 && props.latestNew;
  const quiet = hasLive && props.permission === 'granted' && !props.lateTip && !props.batteryTip;
  const visibleTips: TipId[] = quiet ? ['awake', 'listen', ...(showLatest ? (['latest'] as const) : []), 'settings'] : [];
  const tip = nextTip(props.tips, visibleTips);
  const tipCard = (id: TipId, text: string) =>
    tip === id ? <TipCard text={text} t={t} theme={theme} onGot={() => props.onTip('got', id)} onSkip={() => props.onTip('skip', id)} /> : null;

  const st = props.status;
  const statusLine =
    st.kind === 'asleepPrompt' ? fill(t.statusAsleepPrompt, { time: clock(st.at) })
    : st.kind === 'asleepNone' ? t.asleepNote
    : st.kind === 'inHours' ? fill(t.statusInHours, { time: clock(st.until) })
    : st.kind === 'session' ? fill(t.statusSession, { time: clock(st.until) })
    : st.kind === 'waiting' ? fill(t.statusWaiting, { time: clock(st.at) })
    : null;

  const topBar = (
    <View style={[styles.pinned, { backgroundColor: theme.background }]}>
      <View style={styles.topRow}>
        <Text accessibilityRole="header" style={[styles.brand, { color: theme.text }]}>{t.appName}</Text>
        <View style={styles.menuRow}>
        {props.skyOpen && (
          <Pressable accessibilityRole="button" accessibilityLabel={t.skyOpen} onPress={props.onSky} hitSlop={4} style={[styles.skyButton, { backgroundColor: theme.sky }]}>
            <SkyMark size={30} />
          </Pressable>
        )}
        <OverflowMenu
          label={t.menu}
          theme={theme}
          items={[
            { label: t.help, run: props.onHelp },
            { label: t.settings, run: props.onSettings },
          ]}
        />
        </View>
      </View>
    </View>
  );

  // Listen is a round button beside Awake and Asleep; its tip and hint sit with the toggle.
  const listenButton = hasLive ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.listening ? t.stopListening : t.listen}
      accessibilityHint={t.listenHint}
      accessibilityState={{ selected: props.listening }}
      onPress={props.onListen}
      style={[styles.listenRound, { backgroundColor: props.listening ? theme.button : theme.surface, borderColor: props.listening ? theme.button : theme.line }]}
    >
      <Svg width={24} height={24} viewBox="0 0 24 24">
        {props.listening ? (
          <Rect x={7} y={7} width={10} height={10} rx={2} fill={theme.onButton} />
        ) : (
          <>
            <Path d="M4 14v-2a8 8 0 0 1 16 0v2" fill="none" stroke={theme.text} strokeWidth={2} strokeLinecap="round" />
            <Rect x={3} y={13} width={4} height={7} rx={2} fill={theme.text} />
            <Rect x={17} y={13} width={4} height={7} rx={2} fill={theme.text} />
          </>
        )}
      </Svg>
    </Pressable>
  ) : null;

  const todayLine = useMemo(() => dayLine(props.settings, new Date()), [props.settings, points]);
  const header = (
    <View style={styles.header}>
      {tipCard('settings', t.tipSettings)}

      <View style={styles.toggleRow}>
      <View style={[styles.toggle, { backgroundColor: theme.chip }]} accessibilityRole="radiogroup">
        {([false, true] as const).map((sleep) => {
          const on = props.asleep === sleep;
          return (
            <Pressable
              key={String(sleep)}
              accessibilityRole="radio"
              accessibilityLabel={sleep ? t.asleepA11y : t.awakeA11y}
              accessibilityState={{ selected: on, checked: on }}
              onPress={() => props.onAsleep(sleep)}
              style={[styles.half, on && { backgroundColor: sleep ? theme.sky : theme.button }]}
            >
              <Text style={[styles.halfText, { color: on ? (sleep ? theme.star : theme.onButton) : theme.muted }]}>
                {sleep ? `☾  ${t.asleep}` : `☀  ${t.awake}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {listenButton}
      </View>
      {statusLine && <Text style={[styles.note, { color: theme.muted }]}>{statusLine}</Text>}
      {hasLive && todayLine && <DayLineCard line={todayLine} t={t} theme={theme} />}
      {tipCard('awake', t.tipAwake)}
      {tipCard('listen', t.tipListen)}

      {props.permission !== 'granted' && (
        <Card theme={theme}>
          <Text style={[styles.note, { color: theme.text }]}>{t.notificationsOff}</Text>
          <Button label={t.turnOn} theme={theme} kind="plain" onPress={props.onTurnOn} />
        </Card>
      )}
      {props.lateTip && (
        <Card theme={theme}>
          <Text accessibilityRole="header" style={[styles.tipTitle, { color: theme.text }]}>{t.lateTipTitle}</Text>
          <Text style={[styles.note, { color: theme.muted }]}>{t.lateTipBody}</Text>
          {props.samsung && <Text style={[styles.note, { color: theme.muted }]}>{t.lateTipSamsung}</Text>}
          <View style={styles.row}>
            <Button label={t.openBattery} theme={theme} kind="plain" onPress={() => props.onLateTip(true)} />
            <Button label={t.notNow} theme={theme} kind="quiet" onPress={() => props.onLateTip(false)} />
          </View>
        </Card>
      )}
      {props.batteryTip && !props.lateTip && (
        <Card theme={theme}>
          <Text style={[styles.tipTitle, { color: theme.text }]}>{t.batteryTipTitle}</Text>
          <Text style={[styles.note, { color: theme.muted }]}>{t.batteryTipBody}</Text>
          {props.samsung && <Text style={[styles.note, { color: theme.muted }]}>{t.lateTipSamsung}</Text>}
          <View style={styles.row}>
            <Button label={t.openBattery} theme={theme} kind="plain" onPress={() => props.onBatteryTip(true)} />
            <Button label={t.gotIt} theme={theme} kind="quiet" onPress={() => props.onBatteryTip(false)} />
          </View>
        </Card>
      )}

      {showLatest && tipCard('latest', t.tipLatest)}
      {showLatest && (
        <Button label={t.latestMoment} theme={theme} kind="plain" onPress={props.onLatestMoment} />
      )}
    </View>
  );

  const footer = hasLive ? <Text style={[styles.hint, { color: theme.muted, textAlign: 'center', marginTop: 12 }]}>{t.listenHint}</Text> : undefined;

  const addBar = (
    <View style={[styles.addBar, { backgroundColor: theme.surface, borderTopColor: theme.line }]}>
      {full && (
        <Text accessibilityLiveRegion="polite" style={[styles.note, { color: theme.muted }]}>
          {fill(t.full, { name: category === 'daily' && days <= MAX_DAILY_DAYS ? t.daily : t.longTerm })}
        </Text>
      )}
      <View style={styles.addRow}>
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            setFull(false);
          }}
          placeholder={t.addPlaceholder}
          placeholderTextColor={theme.muted}
          maxLength={MAX_TEXT_LENGTH}
          multiline
          accessibilityLabel={t.addPlaceholder}
          style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
        />
        <Button label={t.keep} theme={{ ...theme, button: tint(theme, category), onButton: onTint(theme, category) }} disabled={!clean} onPress={add} />
      </View>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t.saveTo}>
        {(['daily', 'long_term'] as const).map((c) => (
          <Choice key={c} label={c === 'daily' ? t.daily : t.longTerm} selected={category === c} theme={{ ...theme, button: tint(theme, c), onButton: onTint(theme, c) }} onPress={() => setCategory(c)} />
        ))}
        {category === 'daily' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t.repeatFor} ${days > MAX_DAILY_DAYS ? t.dayMore : days === 1 ? t.dayOne : fill(t.dayMany, { n: days })}`}
            accessibilityState={{ expanded: daysOpen }}
            onPress={() => setDaysOpen((v) => !v)}
            style={[styles.daysChip, { borderColor: tintInk(theme, 'daily') }]}
          >
            <Text style={[styles.daysChipText, { color: tintInk(theme, 'daily') }]}>
              {days > MAX_DAILY_DAYS ? t.dayMore : days === 1 ? t.dayOne : fill(t.dayMany, { n: days })} {daysOpen ? '▴' : '▾'}
            </Text>
          </Pressable>
        )}
      </View>
      {category === 'daily' && daysOpen && (
        <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t.repeatFor}>
          {Array.from({ length: MAX_DAILY_DAYS + 1 }, (_, i) => i + 1).map((d) => (
            <Choice
              key={d}
              label={d > MAX_DAILY_DAYS ? '∞' : String(d)}
              selected={days === d}
              theme={{ ...theme, button: tint(theme, 'daily'), onButton: onTint(theme, 'daily') }}
              onPress={() => setDays(d)}
            />
          ))}
        </View>
      )}
      {category === 'daily' && days > MAX_DAILY_DAYS && <Text style={[styles.note, { color: theme.muted }]}>{t.longTermNote}</Text>}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    {topBar}
    <SectionList
      ref={list}
      sections={sections}
      // A point that is not drawn yet cannot be scrolled to exactly; land near the end instead.
      onScrollToIndexFailed={() => list.current?.getScrollResponder()?.scrollToEnd({ animated: true })}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) =>
        section.key === 'away' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={section.title}
            accessibilityState={{ expanded: showAway }}
            onPress={() => setShowAway((v) => !v)}
            style={styles.sectionHead}
          >
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>{showAway ? '▾' : '▸'} {section.title}</Text>
          </Pressable>
        ) : (
          <View style={styles.sectionHead}>
            <View style={styles.titleRow}>
              <View style={[styles.dot, { backgroundColor: tint(theme, section.category!) }]} />
              <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
              <Text style={[styles.hint, { color: theme.muted }]}>{fill(t.sectionCount, { n: section.data.length, max: MAX_PER_CATEGORY })}</Text>
            </View>
            <Text style={[styles.hint, { color: theme.muted }]}>{section.data.length === 0 ? t.emptyHint : section.hint}</Text>
          </View>
        )
      }
      renderItem={({ item }) => {
        const colour = tint(theme, item.category);
        const isFresh = !item.archived && props.fresh.has(item.id);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFresh ? `${item.text}. ${t.justCameBack}` : item.text}
            accessibilityHint={t.openPoint}
            onPress={() => props.onOpen(item.id)}
            style={({ pressed }) => [
              styles.point,
              { backgroundColor: isFresh ? tintSoft(theme, item.category) : theme.surface },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={styles.bullet}>
              <Star radius={homeRadius(starSize(item.appearances))} color={item.archived ? theme.thread : colour} />
            </View>
            <View style={styles.pointBody}>
            {isFresh && <Text style={[styles.freshTag, { backgroundColor: colour, color: onTint(theme, item.category) }]}>{t.justCameBack}</Text>}
            <PointText style={[styles.pointText, { color: item.archived ? theme.muted : theme.text }]}>{item.text}</PointText>
            {item.private && <Text style={[styles.tag, { color: theme.muted }]}>{t.privateTag}</Text>}
            {!item.archived && paceFor(item) !== 'normal' && (
              <Text style={[styles.tag, { color: theme.muted }]}>{{ every: t.paceEveryTag, often: t.paceOftenTag, rarely: t.paceRarelyTag, normal: '' }[paceFor(item)]}</Text>
            )}
            {!item.archived && lastDay(item.expiresAt)}
            </View>
          </Pressable>
        );
      }}
    />
    {addBar}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  pinned: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  header: { gap: 14, marginBottom: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' },
  brand: { fontSize: 22, fontWeight: '700', letterSpacing: 0.5 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggle: { flex: 1, flexDirection: 'row', borderRadius: 26, padding: 4 },
  listenRound: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  addBar: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  daysChip: { minHeight: 44, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1.5, justifyContent: 'center' },
  daysChipText: { fontSize: 15, fontWeight: '700' },
  half: { flex: 1, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  halfText: { fontSize: 16, fontWeight: '700' },
  note: { fontSize: 15, lineHeight: 22 },
  tipTitle: { fontSize: 16, fontWeight: '700' },
  input: { flex: 1, minHeight: 48, maxHeight: 120, fontSize: 17, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  skyButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { paddingTop: 18, paddingBottom: 8, minHeight: 44, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  hint: { fontSize: 14 },
  point: { flexDirection: 'row', gap: 10, borderRadius: 14, padding: 14, marginBottom: 10 },
  bullet: { width: 32, alignItems: 'center', paddingTop: 2 },
  pointBody: { flex: 1 },
  freshTag: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden', marginBottom: 6 },
  pointText: { fontSize: 17, lineHeight: 24 },
  tag: { fontSize: 13, marginTop: 4 },
  days: { fontSize: 16, fontWeight: '700', minWidth: 64, textAlign: 'center' },
  footer: { marginTop: 18, gap: 8 },
});
