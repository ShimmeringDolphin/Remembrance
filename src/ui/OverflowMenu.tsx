// The ⋮ button: opens a small list under it (Help, Settings). Closes on a tap outside or on a choice.
import { type ComponentRef, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme/calmStudy';

export function OverflowMenu(props: { label: string; theme: Theme; items: { label: string; run: () => void }[] }) {
  const { theme } = props;
  const ref = useRef<ComponentRef<typeof Pressable>>(null);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);

  const open = () => {
    ref.current?.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      // Falls back to the top right corner if the position can't be measured.
      setAt({ top: (y || 0) + (h || 40) + 4, right: 12 });
    });
  };
  const close = () => setAt(null);

  return (
    <View>
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel={props.label}
        accessibilityState={{ expanded: !!at }}
        hitSlop={6}
        onPress={open}
        style={styles.button}
      >
        <Text style={[styles.dots, { color: theme.text }]}>⋮</Text>
      </Pressable>
      <Modal visible={!!at} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel={props.label} accessibilityRole="button">
          <View
            style={[styles.panel, { top: at?.top ?? 0, right: at?.right ?? 12, backgroundColor: theme.surface, borderColor: theme.line }]}
          >
            {props.items.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
                onPress={() => {
                  close();
                  item.run();
                }}
                style={styles.item}
              >
                <Text style={[styles.itemText, { color: theme.text }]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dots: { fontSize: 26, fontWeight: '700', lineHeight: 30 },
  backdrop: { flex: 1 },
  panel: { position: 'absolute', minWidth: 180, borderWidth: 1, borderRadius: 12, paddingVertical: 4, elevation: 6, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  item: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center' },
  itemText: { fontSize: 17 },
});
