// Plain answers to the questions people actually ask, with a button where one helps.
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Strings } from '../i18n/strings';
import { openAppSettings, openBatterySettings } from '../notify/phoneSettings';
import type { Theme } from '../theme/calmStudy';
import { Button, Card } from './parts';

// An answer shows two lines with a fade of three dots; Read more opens it, See less closes it.
// A hidden copy of the full text is measured so short answers get no link.
function Answer(props: { text: string; theme: Theme; t: Strings }) {
  const { text, theme, t } = props;
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  return (
    <View>
      <Text
        style={[styles.a, styles.measure]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onTextLayout={(e) => setLong(e.nativeEvent.lines.length > 2)}
      >
        {text}
      </Text>
      <Text style={[styles.a, { color: theme.muted }]} numberOfLines={open ? undefined : 2} ellipsizeMode="tail">{text}</Text>
      {long && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? t.seeLess : t.readMore}
          accessibilityState={{ expanded: open }}
          hitSlop={8}
          onPress={() => setOpen(!open)}
          style={styles.more}
        >
          <Text style={[styles.moreText, { color: theme.accent }]}>{open ? t.seeLess : t.readMore}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function HelpScreen(props: { t: Strings; theme: Theme; onBack: () => void }) {
  const { t, theme } = props;
  const android = Platform.OS === 'android';
  const items: { q: string; a: string; action?: { label: string; run: () => void } }[] = [
    ...(android ? [{ q: t.q1, a: t.a1, action: { label: t.openBattery, run: () => void openBatterySettings() } }] : []),
    { q: t.q2, a: t.a2, action: { label: t.openNotifications, run: () => void openAppSettings() } },
    { q: t.q3, a: t.a3 },
    ...(android ? [] : [{ q: t.q4, a: t.a4, action: { label: t.openNotifications, run: () => void openAppSettings() } }]),
    { q: t.q5, a: t.a5 },
    { q: t.q6, a: t.a6 },
  ];
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.top}>
        <Button label={t.back} theme={theme} kind="quiet" onPress={props.onBack} />
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{t.helpTitle}</Text>
      </View>
      {items.map((item) => (
        <Card key={item.q} theme={theme}>
          <Text accessibilityRole="header" style={[styles.q, { color: theme.text }]}>{item.q}</Text>
          <Answer text={item.a} theme={theme} t={t} />
          {item.action && <Button label={item.action.label} theme={theme} kind="plain" onPress={item.action.run} />}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 14, paddingBottom: 48 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '700', flexShrink: 1 },
  q: { fontSize: 17, fontWeight: '700', lineHeight: 24 },
  a: { fontSize: 16, lineHeight: 24 },
  measure: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  more: { alignSelf: 'flex-start', paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
  moreText: { fontSize: 15, fontWeight: '700' },
});
