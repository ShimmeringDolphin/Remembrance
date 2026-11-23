// Two small sheets for Awake and Asleep: how long to remind when Awake is tapped outside your hours,
// and the start button a wake-up prompt opens.
import { Modal, StyleSheet, Text, View } from 'react-native';

import type { AwakeAction } from '../core/awake';
import { fill, type Strings } from '../i18n/strings';
import type { Theme } from '../theme/calmStudy';
import { clock } from './clock';
import { Button } from './parts';

type Ask = Extract<AwakeAction, { kind: 'ask' }>;

export function SessionSheet(props: { asking: Ask | null; t: Strings; theme: Theme; from: string; onChoose: (hours: number) => void; onClose: () => void }) {
  const { t, theme, asking } = props;
  const label = (h: number) => (h === 1 ? t.sessionHours1 : h === 2 ? t.sessionHours2 : t.sessionHours4);
  const time = clock(props.from);
  return (
    <Modal visible={asking !== null} transparent animationType="slide" onRequestClose={props.onClose}>
      <View style={[styles.scrim, { backgroundColor: theme.scrim }]}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{t.sessionTitle}</Text>
          <Text style={[styles.body, { color: theme.muted }]}>
            {asking && asking.options.length === 0 ? fill(t.sessionNone, { time }) : fill(t.sessionBody, { time })}
          </Text>
          {asking?.options.map((h) => <Button key={h} label={label(h)} theme={theme} onPress={() => props.onChoose(h)} />)}
          <Button label={asking && asking.options.length === 0 ? t.sessionOk : t.sessionNotNow} theme={theme} kind="quiet" onPress={props.onClose} />
        </View>
      </View>
    </Modal>
  );
}

export function StartSheet(props: { visible: boolean; t: Strings; theme: Theme; onStart: () => void; onClose: () => void }) {
  const { t, theme } = props;
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <View style={[styles.scrim, { backgroundColor: theme.scrim }]}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{t.startTitle}</Text>
          <Text style={[styles.body, { color: theme.muted }]}>{t.startBody}</Text>
          <Button label={t.startButton} theme={theme} onPress={props.onStart} />
          <Button label={t.sessionNotNow} theme={theme} kind="quiet" onPress={props.onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 24, paddingBottom: 40, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 14 },
  title: { fontSize: 22, fontWeight: '700', lineHeight: 30 },
  body: { fontSize: 16, lineHeight: 24 },
});
