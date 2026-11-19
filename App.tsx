import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Category, Point } from './src/core/types';
import { archivePoint, createPoint, listPoints, updatePoint } from './src/db/points';
import { detectLanguage, getStrings } from './src/i18n/strings';
import { calmStudy } from './src/theme/calmStudy';
import { PointEditor } from './src/ui/PointEditor';

function Home() {
  const colors = calmStudy[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const language = useMemo(detectLanguage, []);
  const t = useMemo(() => getStrings(language), [language]);

  const [category, setCategory] = useState<Category>('daily');
  const [points, setPoints] = useState<Point[]>([]);
  const [editing, setEditing] = useState<Point | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const reload = useCallback(async () => setPoints(await listPoints(category)), [category]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const closeEditor = () => setEditorOpen(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
      <View style={styles.tabs}>
        {(['daily', 'long_term'] as const).map((c) => (
          <Pressable
            key={c}
            accessibilityRole="tab"
            accessibilityState={{ selected: category === c }}
            onPress={() => setCategory(c)}
            style={[styles.tab, category === c && { borderBottomColor: colors.accent }]}
          >
            <Text style={[styles.tabText, { color: category === c ? colors.accent : colors.mutedText }]}>
              {c === 'daily' ? t.daily : t.longTerm}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={points}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.mutedText }]}>
            {category === 'daily' ? t.emptyDaily : t.emptyLongTerm}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setEditing(item);
              setEditorOpen(true);
            }}
            style={[styles.card, { borderColor: colors.mutedText }]}
          >
            <Text style={[styles.cardText, { color: colors.text }]}>{item.prompt}</Text>
          </Pressable>
        )}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.addPoint}
        onPress={() => {
          setEditing(null);
          setEditorOpen(true);
        }}
        style={[styles.fab, { backgroundColor: colors.accent, bottom: insets.bottom + 20 }]}
      >
        <Text style={[styles.fabText, { color: colors.onAccent }]}>+</Text>
      </Pressable>

      <PointEditor
        visible={editorOpen}
        point={editing}
        defaultCategory={category}
        t={t}
        colors={colors}
        onCancel={closeEditor}
        onSave={async (value) => {
          if (editing) await updatePoint(editing.id, value);
          else await createPoint({ ...value, language });
          closeEditor();
          await reload();
        }}
        onArchive={async (id) => {
          await archivePoint(id);
          closeEditor();
          await reload();
        }}
      />
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Home />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 16, fontWeight: '600' },
  list: { padding: 16, paddingBottom: 120, gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16 },
  cardText: { fontSize: 18, lineHeight: 26 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 16, paddingHorizontal: 24 },
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  fabText: { fontSize: 30, lineHeight: 34 },
});
