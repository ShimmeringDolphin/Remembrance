// The notebook: a box to add a point, then the points. Nothing to tick off, no counts to keep up.
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { MAX_TEXT_LENGTH, cleanText } from '../core/limits';
import { SKY_UNLOCK, totalAppearances } from '../core/sky';
import type { Category, Point } from '../core/types';
import { fill, type Strings } from '../i18n/strings';
import type { Permission } from '../notify/reminders';
import type { Theme } from '../theme/calmStudy';
import { Button, Card, Choice } from './parts';

interface Props {
  t: Strings;
  theme: Theme;
  points: Point[];
  paused: boolean;
  permission: Permission;
  onAdd: (text: string, category: Category) => Promise<boolean>;
  onOpen: (id: string) => void;
  onSettings: () => void;
  onSky: () => void;
  onResume: () => void;
  onTurnOn: () => void;
}

type Section = { key: string; title: string; hint?: string; data: Point[] };

export function Home(props: Props) {
  const { t, theme, points } = props;
  const [text, setText] = useState('');
  const [category, setCategory] = useState<Category>('daily');
  const [full, setFull] = useState(false);
  const [showAway, setShowAway] = useState(false);

  const sections = useMemo<Section[]>(() => {
    const live = points.filter((p) => !p.archived);
    const away = points.filter((p) => p.archived);
    const out: Section[] = [
      { key: 'daily', title: t.daily, hint: t.dailyHint, data: live.filter((p) => p.category === 'daily') },
      { key: 'long_term', title: t.longTerm, hint: t.longTermHint, data: live.filter((p) => p.category === 'long_term') },
    ];
    if (away.length > 0) out.push({ key: 'away', title: fill(t.putAwaySection, { n: away.length }), data: showAway ? away : [] });
    return out;
  }, [points, showAway, t]);

  const clean = cleanText(text);
  const add = async () => {
    if (!clean) return;
    const ok = await props.onAdd(clean, category);
    setFull(!ok);
    if (ok) setText('');
  };
  const total = totalAppearances(points);

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Text accessibilityRole="header" style={[styles.brand, { color: theme.accent }]}>{t.appName}</Text>
        <Button label={t.settings} theme={theme} kind="quiet" onPress={props.onSettings} />
      </View>
      {props.permission !== 'granted' && (
        <Card theme={theme}>
          <Text style={[styles.note, { color: theme.text }]}>{t.notificationsOff}</Text>
          <Button label={t.turnOn} theme={theme} kind="plain" onPress={props.onTurnOn} />
        </Card>
      )}
      {props.paused && (
        <Card theme={theme}>
          <Text style={[styles.note, { color: theme.text }]}>{t.pausedNote}</Text>
          <Button label={t.resume} theme={theme} kind="plain" onPress={props.onResume} />
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
          <Choice label={t.daily} selected={category === 'daily'} theme={theme} onPress={() => setCategory('daily')} />
          <Choice label={t.longTerm} selected={category === 'long_term'} theme={theme} onPress={() => setCategory('long_term')} />
        </View>
        {full && (
          <Text accessibilityLiveRegion="polite" style={[styles.note, { color: theme.muted }]}>
            {fill(t.full, { name: category === 'daily' ? t.daily : t.longTerm })}
          </Text>
        )}
        <Button label={t.keep} theme={theme} disabled={!clean} onPress={add} />
      </Card>
      {total >= SKY_UNLOCK && (
        <Pressable accessibilityRole="button" accessibilityLabel={t.skyOpen} onPress={props.onSky} style={[styles.sky, { backgroundColor: theme.sky }]}>
          <Text style={[styles.skyTitle, { color: theme.star }]}>✦ {t.skyTitle}</Text>
          <Text style={[styles.skyBody, { color: '#D9DCF0' }]}>{t.skyCardBody}</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={header}
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
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
            <Text style={[styles.hint, { color: theme.muted }]}>{section.data.length === 0 ? t.emptyHint : section.hint}</Text>
          </View>
        )
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.text}
          accessibilityHint={t.openPoint}
          onPress={() => props.onOpen(item.id)}
          style={({ pressed }) => [styles.point, { borderColor: theme.line, backgroundColor: theme.surface }, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.pointText, { color: item.archived ? theme.muted : theme.text }]}>{item.text}</Text>
          {item.private && <Text style={[styles.tag, { color: theme.muted }]}>{t.privateTag}</Text>}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 48, gap: 8 },
  header: { gap: 14, marginBottom: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontSize: 22, fontWeight: '700', letterSpacing: 1 },
  note: { fontSize: 15, lineHeight: 22 },
  input: { minHeight: 56, fontSize: 18, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sky: { borderRadius: 14, padding: 16, gap: 4 },
  skyTitle: { fontSize: 18, fontWeight: '700' },
  skyBody: { fontSize: 15, lineHeight: 22 },
  sectionHead: { paddingTop: 18, paddingBottom: 6, minHeight: 44, justifyContent: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  hint: { fontSize: 14 },
  point: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8 },
  pointText: { fontSize: 17, lineHeight: 24 },
  tag: { fontSize: 13, marginTop: 4 },
});
