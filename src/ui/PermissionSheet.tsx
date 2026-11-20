import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Strings } from '../i18n/strings';
import type { calmStudy } from '../theme/calmStudy';

type Colors = (typeof calmStudy)['light'] | (typeof calmStudy)['dark'];

interface Props {
  visible: boolean;
  t: Strings;
  colors: Colors;
  onAllow: () => void;
  onLater: () => void;
}

/** Shown once, right after the first point is saved: the moment the reason is obvious. */
export function PermissionSheet({ visible, t, colors, onAllow, onLater }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onLater}>
      <View style={[styles.backdrop, { backgroundColor: colors.scrim }]}>
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20, borderColor: colors.mutedText }]}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {t.permTitle}
          </Text>
          <Text style={[styles.body, { color: colors.mutedText }]}>{t.permBody}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t.allowNotifications} onPress={onAllow} style={[styles.allow, { backgroundColor: colors.accent }]}>
            <Text style={{ color: colors.onAccent, fontWeight: '600', fontSize: 16 }}>{t.allowNotifications}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t.permLater} onPress={onLater} style={styles.later}>
            <Text style={{ color: colors.accent, fontSize: 16 }}>{t.permLater}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 24, gap: 14 },
  title: { fontSize: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23 },
  allow: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  later: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
