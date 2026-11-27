// A first-run tip: one short sentence next to the control it explains, with OK and Skip tips. Never blocks the screen.
import { StyleSheet, View } from 'react-native';
import { Text } from './AppText';

import type { Strings } from '../i18n/strings';
import type { Theme } from '../theme/calmStudy';
import { Button } from './parts';

export function TipCard(props: { text: string; t: Strings; theme: Theme; onGot: () => void; onSkip: () => void }) {
  const { t, theme } = props;
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <Text accessibilityLiveRegion="polite" style={[styles.text, { color: theme.text }]}>{props.text}</Text>
      <View style={styles.row}>
        <Button label={t.gotIt} theme={theme} kind="plain" onPress={props.onGot} />
        <Button label={t.tipSkip} theme={theme} kind="quiet" onPress={props.onSkip} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 8 },
  text: { fontSize: 15, lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
