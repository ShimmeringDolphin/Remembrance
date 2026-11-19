import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { calmStudy } from './src/theme/calmStudy';

export default function App() {
  const colors = calmStudy[useColorScheme() === 'dark' ? 'dark' : 'light'];
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.accent }]}>YaadOM</Text>
      <Text style={[styles.subtitle, { color: colors.mutedText }]}>
        Points of remembrance, repeated through your day.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: '600' },
  subtitle: { fontSize: 16, marginTop: 8, textAlign: 'center' },
});
