// The notebook: Awake/Asleep, a box to add a point, then the points in their colours.
// Nothing to tick off and no counts to keep up. Points from the latest reminder glow for a while.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { DEFAULT_DAILY_DAYS, lastDayOf, MAX_DAILY_DAYS, sameDay } from '../core/expiry';
import { MAX_TEXT_LENGTH, cleanText } from '../core/limits';
import type { Category, Point } from '../core/types';
import { fill, type Strings } from '../i18n/strings';
import type { Permission } from '../notify/reminders';
import { tint, tintSoft, type Theme } from '../theme/calmStudy';
import { Button, Card, Choice } from './parts';

interface Props {
  t: Strings;
  theme: Theme;
  points: Point[];
  asleep: boolean;
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
  onTurnOn: () => void;
  onBatteryTip: (open: boolean) => void;
  onLatestMoment: () => void;
  /** The latest reminder has not been gone through yet. */
  latestNew: boolean;
  onListen: () => void;
}

type Section = { key: string; title: string; hint?: string; category?: Category; data: Point[] };

export function Home(props: Props) {
  const { t, theme, points } = props;
  const [text, setText] = useState('');
  const [category, setCategory] = useState<Category>('daily');
  const [days, setDays] = useState(DEFAULT_DAILY_DAYS);
  const [full, setFull] = useState(false);
  const [showAway, setShowAway] = useState(false);

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
    return <Text style={[styles.tag, { color: tint(theme, 'daily') }]}>{text}</Text>;
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Text accessibilityRole="header" style={[styles.brand, { color: theme.accent }]}>{t.appName}</Text>
        <View style={styles.row}>
          <Button label={t.help} theme={theme} kind="quiet" onPress={props.onHelp} />
          <Button label={t.settings} theme={theme} kind="quiet" onPress={props.onSettings} />
        </View>
      </View>

      <View style={[styles.toggle, { borderColor: theme.line, backgroundColor: theme.surface }]} accessibilityRole="radiogroup">
        {([false, true] as const).map((sleep) => {
          const on = props.asleep === sleep;
          return (
            <Pressable
              key={String(sleep)}
              accessibilityRole="radio"
              accessibilityLabel={sleep ? t.asleepA11y : t.awakeA11y}
              accessibilityState={{ selected: on, checked: on }}
              onPress={() => props.onAsleep(sleep)}
              style={[styles.half, on && { backgroundColor: sleep ? theme.sky : theme.accent }]}
            >
              <Text style={[styles.halfText, { color: on ? (sleep ? theme.star : theme.onAccent) : theme.muted }]}>
                {sleep ? `☾  ${t.asleep}` : `☀  ${t.awake}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {props.asleep && <Text style={[styles.note, { color: theme.muted }]}>{t.asleepNote}</Text>}

      {props.permission !== 'granted' && (
        <Card theme={theme}>
          <Text style={[styles.note, { color: theme.text }]}>{t.notificationsOff}</Text>
          <Button label={t.turnOn} theme={theme} kind="plain" onPress={props.onTurnOn} />
        </Card>
      )}
      {props.batteryTip && (
        <Card theme={theme}>
          <Text style={[styles.tipTitle, { color: theme.text }]}>{t.batteryTipTitle}</Text>
          <Text style={[styles.note, { color: theme.muted }]}>{t.batteryTipBody}</Text>
          <View style={styles.row}>
            <Button label={t.openBattery} theme={theme} kind="plain" onPress={() => props.onBatteryTip(true)} />
            <Button label={t.gotIt} theme={theme} kind="quiet" onPress={() => props.onBatteryTip(false)} />
          </View>
        </Card>
      )}

      <Card theme={theme}>
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
          style={[styles.input, { color: theme.text }]}
        />
        <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t.saveTo}>
          {(['daily', 'long_term'] as const).map((c) => (
            <Choice key={c} label={c === 'daily' ? t.daily : t.longTerm} selected={category === c} theme={{ ...theme, accent: tint(theme, c) }} onPress={() => setCategory(c)} />
          ))}
        </View>
        {category === 'daily' && (
          <View style={styles.row}>
            <Text style={[styles.note, { color: theme.text }]}>{t.repeatFor}</Text>
            <Button label="−" hint={t.fewerDays} theme={theme} kind="plain" disabled={days <= 1} onPress={() => setDays((d) => Math.max(1, d - 1))} />
            <Text accessibilityLiveRegion="polite" style={[styles.days, { color: tint(theme, 'daily') }]}>
              {days > MAX_DAILY_DAYS ? t.dayMore : days === 1 ? t.dayOne : fill(t.dayMany, { n: days })}
            </Text>
            <Button label="+" hint={t.moreDays} theme={theme} kind="plain" disabled={days > MAX_DAILY_DAYS} onPress={() => setDays((d) => Math.min(MAX_DAILY_DAYS + 1, d + 1))} />
          </View>
        )}
        {category === 'daily' && days > MAX_DAILY_DAYS && <Text style={[styles.note, { color: theme.muted }]}>{t.longTermNote}</Text>}
        {full && (
          <Text accessibilityLiveRegion="polite" style={[styles.note, { color: theme.muted }]}>
            {fill(t.full, { name: category === 'daily' && days <= MAX_DAILY_DAYS ? t.daily : t.longTerm })}
          </Text>
        )}
        <Button label={t.keep} theme={{ ...theme, accent: tint(theme, category) }} disabled={!clean} onPress={add} />
      </Card>

      {props.fresh.size > 0 && props.latestNew && (
        <Button label={t.latestMoment} theme={theme} kind="plain" onPress={props.onLatestMoment} />
      )}
      {props.skyOpen && (
        <Pressable accessibilityRole="button" accessibilityLabel={t.skyOpen} onPress={props.onSky} style={[styles.sky, { backgroundColor: theme.sky }]}>
          <Text style={[styles.skyTitle, { color: theme.star }]}>✦ {t.skyTitle}</Text>
          <Text style={[styles.skyBody, { color: theme.skyText }]}>{t.skyCardBody}</Text>
        </Pressable>
      )}
    </View>
  );

  const footer = hasLive ? (
    <View style={styles.footer}>
      <Button label={props.listening ? t.stopListening : t.listen} theme={theme} kind={props.listening ? 'main' : 'plain'} onPress={props.onListen} />
      <Text style={[styles.hint, { color: theme.muted, textAlign: 'center' }]}>{t.listenHint}</Text>
    </View>
  ) : undefined;

  return (
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
              { borderColor: isFresh ? colour : theme.line, borderLeftColor: item.archived ? theme.line : colour, backgroundColor: isFresh ? tintSoft(theme, item.category) : theme.surface },
              pressed && { opacity: 0.7 },
            ]}
          >
            {isFresh && <Text style={[styles.freshTag, { backgroundColor: colour, color: theme.onAccent }]}>{t.justCameBack}</Text>}
            <Text style={[styles.pointText, { color: item.archived ? theme.muted : theme.text }]}>{item.text}</Text>
            {item.private && <Text style={[styles.tag, { color: theme.muted }]}>{t.privateTag}</Text>}
            {!item.archived && item.pace !== 'normal' && (
              <Text style={[styles.tag, { color: theme.muted }]}>{item.pace === 'often' ? t.paceOftenTag : t.paceRarelyTag}</Text>
            )}
            {!item.archived && lastDay(item.expiresAt)}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 48 },
  header: { gap: 14, marginBottom: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' },
  brand: { fontSize: 22, fontWeight: '700', letterSpacing: 0.5 },
  toggle: { flexDirection: 'row', borderWidth: 1, borderRadius: 26, padding: 4 },
  half: { flex: 1, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  halfText: { fontSize: 16, fontWeight: '700' },
  note: { fontSize: 15, lineHeight: 22 },
  tipTitle: { fontSize: 16, fontWeight: '700' },
  input: { minHeight: 56, fontSize: 18, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  sky: { borderRadius: 14, padding: 16, gap: 4 },
  skyTitle: { fontSize: 18, fontWeight: '700' },
  skyBody: { fontSize: 15, lineHeight: 22 },
  sectionHead: { paddingTop: 18, paddingBottom: 8, minHeight: 44, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  hint: { fontSize: 14 },
  point: { borderWidth: 1, borderLeftWidth: 6, borderRadius: 12, padding: 14, marginBottom: 10 },
  freshTag: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden', marginBottom: 6 },
  pointText: { fontSize: 17, lineHeight: 24 },
  tag: { fontSize: 13, marginTop: 4 },
  days: { fontSize: 16, fontWeight: '700', minWidth: 64, textAlign: 'center' },
  footer: { marginTop: 18, gap: 8 },
});
