import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Linking, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { pickReviewPoints, pointIdsFromNotificationData } from './src/core/review';
import { defaultSettings } from './src/core/settingsDefaults';
import type { Category, Point, Settings } from './src/core/types';
import { archivePoint, createPoint, listActivePoints, listPoints, updatePoint } from './src/db/points';
import { getSettings, saveSettings } from './src/db/settings';
import { detectLanguage, getStrings } from './src/i18n/strings';
import {
  getPermissionState,
  initNotifications,
  type PermissionState,
  requestPermission,
  syncReminders,
} from './src/notifications/reminders';
import { calmStudy } from './src/theme/calmStudy';
import { ArchiveScreen } from './src/ui/ArchiveScreen';
import { PointEditor } from './src/ui/PointEditor';
import { ReviewScreen } from './src/ui/ReviewScreen';
import { SettingsScreen } from './src/ui/SettingsScreen';

function Home() {
  const colors = calmStudy[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const language = useMemo(detectLanguage, []);
  const [settings, setSettings] = useState<Settings>(() => defaultSettings(language));
  const t = useMemo(() => getStrings(settings.appLanguage), [settings.appLanguage]);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [category, setCategory] = useState<Category>('daily');
  const [points, setPoints] = useState<Point[]>([]);
  const [editing, setEditing] = useState<Point | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPoints, setReviewPoints] = useState<Point[]>([]);

  const reload = useCallback(async () => setPoints(await listPoints(category)), [category]);
  useEffect(() => {
    void reload();
  }, [reload]);

  /** Opens Review now with the points a reminder named, or with this tab's points when `ids` is null. */
  const openReview = useCallback(
    async (ids: string[] | null) => {
      const source = ids === null ? await listPoints(category) : await listActivePoints();
      setReviewPoints(pickReviewPoints(source, ids));
      setReviewOpen(true);
    },
    [category],
  );

  // Tapping a reminder opens Review now with the points it was about. Each tap is handled once.
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponse = useRef<string | null>(null);
  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const request = lastResponse.notification.request;
    const key = `${request.identifier}|${lastResponse.notification.date}`;
    if (handledResponse.current === key) return;
    handledResponse.current = key;
    Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    const ids = pointIdsFromNotificationData(request.content.data);
    if (ids) void openReview(ids);
  }, [lastResponse, openReview]);

  // Startup: load settings, check permission, book reminders.
  useEffect(() => {
    void (async () => {
      // Settings must load even if notification setup fails, or the app would save defaults over them.
      try {
        await initNotifications();
      } catch (e) {
        console.warn('Notification setup failed', e);
      }
      setSettings(await getSettings());
      setPermission(await getPermissionState());
      await syncReminders();
    })();
  }, []);

  // Coming back to the app refills the booked reminders (iOS holds only 64 at once).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void (async () => {
          setPermission(await getPermissionState());
          await syncReminders();
        })();
      }
    });
    return () => sub.remove();
  }, []);

  const updateSettings = async (next: Settings) => {
    setSettings(next);
    await saveSettings(next);
    await syncReminders();
  };

  const toggleAwake = async () => {
    const awake = !settings.awake;
    if (awake && permission === 'undetermined') setPermission(await requestPermission());
    await updateSettings({ ...settings, awake });
  };

  const allowNotifications = async () => {
    if (permission === 'undetermined') {
      setPermission(await requestPermission());
      await syncReminders();
    } else {
      await Linking.openSettings();
    }
  };

  const closeEditor = () => setEditorOpen(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: settings.awake }}
          onPress={() => void toggleAwake()}
          style={[styles.awake, { borderColor: colors.accent, backgroundColor: settings.awake ? colors.accent : 'transparent' }]}
        >
          <Text style={{ color: settings.awake ? colors.onAccent : colors.accent, fontWeight: '600' }}>
            {settings.awake ? `● ${t.awake}` : `○ ${t.asleep}`}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t.settings} onPress={() => setSettingsOpen(true)} style={styles.gear}>
          <Text style={{ color: colors.accent, fontSize: 22 }}>⚙</Text>
        </Pressable>
      </View>

      {settings.awake && permission !== 'granted' ? (
        <View style={[styles.banner, { borderColor: colors.accent }]}>
          <Text style={{ color: colors.text }}>{t.notificationsOff}</Text>
          <Pressable accessibilityRole="button" onPress={() => void allowNotifications()}>
            <Text style={{ color: colors.accent, fontWeight: '600', marginTop: 6 }}>
              {permission === 'undetermined' ? t.allowNotifications : t.openSettings}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.reviewNow}
          onPress={() => void openReview(null)}
          style={[styles.action, { borderColor: colors.accent }]}
        >
          <Text style={{ color: colors.accent, fontWeight: '600' }}>{t.reviewNow}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.archived}
          onPress={() => setArchiveOpen(true)}
          style={[styles.action, { borderColor: colors.mutedText }]}
        >
          <Text style={{ color: colors.mutedText }}>{t.archived}</Text>
        </Pressable>
      </View>

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
          else await createPoint({ ...value, language: settings.appLanguage });
          closeEditor();
          await reload();
          await syncReminders();
        }}
        onArchive={async (id) => {
          await archivePoint(id);
          closeEditor();
          await reload();
          await syncReminders();
        }}
      />
      <SettingsScreen
        visible={settingsOpen}
        settings={settings}
        t={t}
        colors={colors}
        onChange={(next) => void updateSettings(next)}
        onClose={() => setSettingsOpen(false)}
      />
      <ArchiveScreen
        visible={archiveOpen}
        t={t}
        colors={colors}
        onRestored={() => {
          void reload();
          void syncReminders();
        }}
        onClose={() => setArchiveOpen(false)}
      />
      <ReviewScreen
        visible={reviewOpen}
        points={reviewPoints}
        t={t}
        colors={colors}
        onClose={() => {
          setReviewOpen(false);
          setReviewPoints([]);
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  awake: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  gear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  banner: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderWidth: 1, borderRadius: 12 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  action: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
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
