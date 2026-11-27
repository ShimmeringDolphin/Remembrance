// Plain answers to the questions people actually ask, with a button where one helps.
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Strings } from '../i18n/strings';
import { openAppSettings, openBatterySettings, openSpeechSettings, openVoiceDownload } from '../notify/phoneSettings';
import type { Theme } from '../theme/calmStudy';
import { OverflowMenu } from './OverflowMenu';
import { Button, Card, Header } from './parts';

// An answer shows two lines. When it is longer, "... Read more" ends the second line and opens the rest;
// "See less" closes it. Hidden copies of the text are measured: the full text to see if it
// needs more than two lines, then the cut text is trimmed until its last line fits "... Read more".
function Answer(props: { text: string; theme: Theme; t: Strings }) {
  const { text, theme, t } = props;
  const [open, setOpen] = useState(false);
  const [base, setBase] = useState<string | null>(null); // first two lines of a long answer
  const [keep, setKeep] = useState(0);
  const [fits, setFits] = useState(false);

  const body = [styles.a, { color: theme.muted }];
  const link = [styles.moreText, { color: theme.accent }];
  const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;
  const cut = base === null ? '' : base.slice(0, keep).trimEnd();

  return (
    <View>
      <Text
        {...hidden}
        style={[styles.a, styles.measure]}
        onTextLayout={(e) => {
          const lines = e.nativeEvent.lines;
          setFits(false);
          if (lines.length > 2) {
            const two = lines[0].text + lines[1].text;
            setBase(two);
            setKeep(two.length);
          } else {
            setBase(null);
          }
        }}
      >
        {text}
      </Text>
      {base !== null && !fits && (
        <Text
          {...hidden}
          style={[styles.a, styles.measure]}
          onTextLayout={(e) => {
            if (e.nativeEvent.lines.length <= 2 || keep <= 0) setFits(true);
            else setKeep(Math.max(0, keep - 2));
          }}
        >
          {cut}… <Text style={link}>{t.readMore}</Text>
        </Text>
      )}
      {base === null || open ? (
        <Text textBreakStrategy="simple" style={body}>{text}</Text>
      ) : (
        <Text textBreakStrategy="simple" style={body} numberOfLines={2} ellipsizeMode="clip" accessibilityLabel={text}>
          {fits ? cut : ''}
          {fits ? '… ' : ''}
          {fits && (
            <Text accessibilityRole="button" accessibilityLabel={t.readMore} style={link} onPress={() => setOpen(true)}>
              {t.readMore}
            </Text>
          )}
          {!fits && text}
        </Text>
      )}
      {base !== null && open && (
        <Pressable accessibilityRole="button" accessibilityLabel={t.seeLess} accessibilityState={{ expanded: true }} hitSlop={8} onPress={() => setOpen(false)} style={styles.more}>
          <Text style={link}>{t.seeLess}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function HelpScreen(props: { t: Strings; theme: Theme; onBack: () => void; onGo: (to: 'home' | 'settings') => void; onTipsAgain: () => void }) {
  const { t, theme } = props;
  const android = Platform.OS === 'android';
  const items: { q: string; a: string; actions?: { label: string; run: () => void }[] }[] = [
    ...(android ? [{ q: t.q1, a: t.a1, actions: [{ label: t.openBattery, run: () => void openBatterySettings() }] }] : []),
    { q: t.q2, a: t.a2, actions: [{ label: t.openNotifications, run: () => void openAppSettings() }] },
    { q: t.q3, a: t.a3 },
    ...(android ? [] : [{ q: t.q4, a: t.a4, actions: [{ label: t.openNotifications, run: () => void openAppSettings() }] }]),
    { q: t.q5, a: t.a5 },
    { q: t.q6, a: t.a6 },
    { q: t.q7, a: t.a7 },
    {
      q: t.qSpeech,
      a: t.aSpeech,
      ...(android ? { actions: [{ label: t.openSpeech, run: () => void openSpeechSettings() }, { label: t.downloadVoices, run: () => void openVoiceDownload() }] } : {}),
    },
    { q: t.qTips, a: t.aTips, actions: [{ label: t.tipsAgain, run: props.onTipsAgain }] },
  ];
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Header
        title={t.helpTitle}
        backLabel={t.back}
        onBack={props.onBack}
        color={theme.accent}
        titleColor={theme.text}
        right={<OverflowMenu label={t.menu} theme={theme} items={[{ label: t.home, run: () => props.onGo('home') }, { label: t.settings, run: () => props.onGo('settings') }]} />}
      />
      {items.map((item) => (
        <Card key={item.q} theme={theme}>
          <Text accessibilityRole="header" textBreakStrategy="simple" style={[styles.q, { color: theme.text }]}>{item.q}</Text>
          <Answer text={item.a} theme={theme} t={t} />
          {item.actions?.map((a) => <Button key={a.label} label={a.label} theme={theme} kind="plain" onPress={a.run} />)}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 14, paddingBottom: 48 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '700', flexShrink: 1 },
  spacer: { flex: 1 },
  q: { fontSize: 17, fontWeight: '700', lineHeight: 24 },
  a: { fontSize: 16, lineHeight: 24 },
  measure: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  more: { alignSelf: 'flex-start', paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
  moreText: { fontSize: 15, fontWeight: '700' },
});
