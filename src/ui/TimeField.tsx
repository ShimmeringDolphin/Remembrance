// A time you can tap to set with the phone's own picker: Android's clock dialog (which also
// offers typing the time) or the iPhone wheel.
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTime, parseTime } from '../core/time';
import { fill, type Strings } from '../i18n/strings';
import type { Theme } from '../theme/calmStudy';
import { Button } from './parts';

function toDate(hhmm: string): Date {
  const m = parseTime(hhmm);
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}
export const fromDate = (d: Date) => formatTime(d.getHours() * 60 + d.getMinutes());

export function TimeField(props: { label: string; value: string; onChange: (v: string) => void; t: Strings; theme: Theme }) {
  const { theme } = props;
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState(() => toDate(props.value));

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(props.value),
        mode: 'time',
        is24Hour: true,
        onValueChange: (_e, d) => props.onChange(fromDate(d)),
      });
    } else {
      setDraft(toDate(props.value));
      setIosOpen(true);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={fill(props.t.setTime, { label: props.label, time: props.value })}
        onPress={open}
        style={({ pressed }) => [styles.chip, { borderColor: theme.line, backgroundColor: pressed ? theme.soft : theme.background }]}
      >
        <Text style={[styles.time, { color: theme.text }]}>{props.value}</Text>
      </Pressable>
      {Platform.OS === 'ios' && (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View style={[styles.scrim, { backgroundColor: theme.scrim }]}>
            <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
              <Text style={[styles.label, { color: theme.text }]}>{props.label}</Text>
              <DateTimePicker value={draft} mode="time" display="spinner" is24Hour onValueChange={(_e, d) => setDraft(d)} />
              <Button
                label={props.t.save}
                theme={theme}
                onPress={() => {
                  props.onChange(fromDate(draft));
                  setIosOpen(false);
                }}
              />
              <Button label={props.t.cancel} theme={theme} kind="quiet" onPress={() => setIosOpen(false)} />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  chip: { minWidth: 84, minHeight: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  time: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 20, paddingBottom: 36, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 10 },
  label: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
});
