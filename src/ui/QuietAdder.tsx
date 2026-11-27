// "Add quiet hours": asks for the start and then the end with the phone's own picker, so nothing
// is prefilled. Android shows its clock dialog twice (each one also offers typing the time);
// iPhone shows both wheels in one sheet.
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { Text } from './AppText';

import type { TimeRange } from '../core/types';
import type { Strings } from '../i18n/strings';
import type { Theme } from '../theme/calmStudy';
import { Button } from './parts';
import { fromDate } from './TimeField';

/** The picker opens on the next whole hour; this is where the wheel starts, not a saved value. */
function nextHour(plus = 0): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1 + plus, 0, 0, 0);
  return d;
}

export function QuietAdder(props: { t: Strings; theme: Theme; onAdd: (r: TimeRange) => void }) {
  const { t, theme } = props;
  const [iosOpen, setIosOpen] = useState(false);
  const [start, setStart] = useState(nextHour);
  const [end, setEnd] = useState(() => nextHour(1));

  const open = () => {
    if (Platform.OS !== 'android') {
      setStart(nextHour());
      setEnd(nextHour(1));
      setIosOpen(true);
      return;
    }
    DateTimePickerAndroid.open({
      value: nextHour(),
      mode: 'time',
      is24Hour: true,
      positiveButton: { label: t.quietStartOk },
      onValueChange: (_e, from) => {
        const later = new Date(from.getTime() + 60 * 60000);
        DateTimePickerAndroid.open({
          value: later,
          mode: 'time',
          is24Hour: true,
          positiveButton: { label: t.quietEndOk },
          onValueChange: (_e2, until) => props.onAdd({ start: fromDate(from), end: fromDate(until) }),
        });
      },
    });
  };

  return (
    <>
      <Button label={t.addQuiet} theme={theme} kind="plain" onPress={open} />
      {Platform.OS === 'ios' && (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View style={[styles.scrim, { backgroundColor: theme.scrim }]}>
            <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
              <Text style={[styles.label, { color: theme.text }]}>{t.quietTitle}</Text>
              <Text style={[styles.small, { color: theme.muted }]}>{t.from}</Text>
              <DateTimePicker value={start} mode="time" display="spinner" is24Hour onValueChange={(_e, d) => setStart(d)} />
              <Text style={[styles.small, { color: theme.muted }]}>{t.until}</Text>
              <DateTimePicker value={end} mode="time" display="spinner" is24Hour onValueChange={(_e, d) => setEnd(d)} />
              <Button
                label={t.save}
                theme={theme}
                onPress={() => {
                  props.onAdd({ start: fromDate(start), end: fromDate(end) });
                  setIosOpen(false);
                }}
              />
              <Button label={t.cancel} theme={theme} kind="quiet" onPress={() => setIosOpen(false)} />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 20, paddingBottom: 36, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 8 },
  label: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  small: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
