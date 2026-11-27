// Asked once, right after the first point is kept, so the question makes sense.
import { Modal, StyleSheet, View } from 'react-native';
import { Text } from './AppText';

import { fill, type Strings } from '../i18n/strings';
import type { Theme } from '../theme/calmStudy';
import { Button } from './parts';

export function PermissionSheet(props: { visible: boolean; t: Strings; theme: Theme; from: string; to: string; onYes: () => void; onLater: () => void }) {
  const { t, theme } = props;
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onLater}>
      <View style={[styles.scrim, { backgroundColor: theme.scrim }]}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{t.permissionTitle}</Text>
          <Text style={[styles.body, { color: theme.muted }]}>{fill(t.permissionBody, { from: props.from, to: props.to })}</Text>
          <Button label={t.permissionYes} theme={theme} onPress={props.onYes} />
          <Button label={t.permissionLater} theme={theme} kind="quiet" onPress={props.onLater} />
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
