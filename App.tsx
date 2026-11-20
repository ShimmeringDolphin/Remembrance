import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Linking, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { pointIdsFromData } from './src/core/reminderData';
import { defaultSettings } from './src/core/settingsDefaults';
import { canAddPoint, MAX_POINTS_PER_CATEGORY } from './src/core/limits';
import { skyUnlocked, totalAppearances } from './src/core/sky';
import type { Category, Point, Settings } from './src/core/types';
import { archivePoint, countPoints, createPoint, listActivePoints, listPoints, updatePoint } from './src/db/points';
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
import { PointEditor } from './src/ui/PointEditor';
import { ReviewScreen } from './src/ui/ReviewScreen';
import { ArchivedScreen } from './src/ui/ArchivedScreen';
import { PermissionSheet } from './src/ui/PermissionSheet';
import { SettingsScreen } from './src/ui/SettingsScreen';
import { SkyScreen } from './src/ui/SkyScreen';
import { Welcome } from './src/ui/Welcome';

function Home() {
  const colors = calmStudy[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const language = useMemo(detectLanguage, []);
  const [settings, setSettings] = useState<Settings>(() => defaultSettings(language));
  const t = useMemo(() => getStrings(settings.appLanguage), [settings.appLanguage]);
  // Settings and the Awake button stay disabled until the saved settings have loaded, so the
  // defaults can never be saved over the user's real settings.
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewIds, setReviewIds] = useState<string[]>([]);

  // Tapping a reminder opens Review now with that reminder's points. Each tap is handled once.
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponse = useRef<string | null>(null);
  useEffect(() => {
    if (!lastResponse) return;
    const key = `${lastResponse.notification.request.identifier}:${lastResponse.notification.date}`;
    if (handledResponse.current === key) return;
    handledResponse.current = key;
    setReviewIds(pointIdsFromData(lastResponse.notification.request.content.data));
    setReviewOpen(true);
  }, [lastResponse]);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const [category, setCategory] = useState<Category>('daily');
  const [points, setPoints] = useState<Point[]>([]);
  const [editing, setEditing] = useState<Point | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const [counts, setCounts] = useState<{ daily: number; long_term: number; total: number } | null>(null);
  const [active, setActive] = useState<Point[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [permissionSheetOpen, setPermissionSheetOpen] = useState(false);
  const [skyOpen, setSkyOpen] = useState(false);

  const reload = useCallback(async () => {
    const [list, c, all] = await Promise.all([listPoints(category), countPoints(), listActivePoints()]);
    setPoints(list);
    setCounts(c);
    setActive(all);
  }, [category]);

  // Listeners registered once call the latest reload through this ref, so they never use a stale tab.
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  const limitMessage = (c: Category) => (c === 'daily' ? t.limitDaily : t.limitLongTerm).replace('{n}', String(MAX_POINTS_PER_CATEGORY));
  useEffect(() => {
    void reload();
  }, [reload]);

  // Startup: load settings, check permission, book reminders.
  useEffect(() => {
    void (async () => {
      try {
        await initNotifications();
      } catch (error) {
        console.warn('Could not set up notifications:', error);
      }
      setSettings(await getSettings());
      setSettingsLoaded(true);
      setPermission(await getPermissionState());
      await syncReminders();
      // Rebooking counted new appearances; show them.
      await reloadRef.current();
    })();
  }, []);

  // Coming back to the app refills the booked reminders (iOS holds only 64 at once).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void (async () => {
          setPermission(await getPermissionState());
          await syncReminders();
          await reloadRef.current();
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

  // First run: the very first point. Defaults are already in place; ask for notifications only now,
  // when the reason is obvious.
  const saveFirstPoint = async (prompt: string) => {
    await createPoint({ prompt, category: 'daily', language: settings.appLanguage });
    await reload();
    if (permission === 'undetermined') setPermissionSheetOpen(true);
    await syncReminders();
  };

  const openAdd = () => {
    if (counts && !canAddPoint(category === 'daily' ? counts.daily : counts.long_term)) {
      setNotice(limitMessage(category));
      return;
    }
    setNotice(null);
    setEditing(null);
    setEditorOpen(true);
  };

  const firstRun = counts !== null && counts.total === 0;
  const total = totalAppearances(active);

  // Until the counts load, show only the background so the first-run screen never flickers.
  if (counts === null) return <View style={[styles.container, { backgroundColor: colors.background }]} />;

  if (firstRun) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <Welcome t={t} colors={colors} onSave={saveFirstPoint} />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: settings.awake, disabled: !settingsLoaded }}
          disabled={!settingsLoaded}
          onPress={() => void toggleAwake()}
          style={[styles.awake, { borderColor: colors.accent, backgroundColor: settings.awake ? colors.accent : 'transparent' }]}
        >
          <Text style={{ color: settings.awake ? colors.onAccent : colors.accent, fontWeight: '600' }}>
            {settings.awake ? `● ${t.awake}` : `○ ${t.asleep}`}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.reviewNow}
          onPress={() => {
            setReviewIds([]);
            setReviewOpen(true);
          }}
          style={styles.review}
        >
          <Text style={{ color: colors.accent }}>{t.reviewNow}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t.archived} onPress={() => setArchivedOpen(true)} style={styles.archived}>
          <Text style={{ color: colors.accent }}>{t.archived}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t.settings} disabled={!settingsLoaded} onPress={() => setSettingsOpen(true)} style={[styles.gear, !settingsLoaded && { opacity: 0.4 }]}>
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

      <View style={styles.tabs}>
        {(['daily', 'long_term'] as const).map((c) => (
          <Pressable
            key={c}
            accessibilityRole="tab"
            accessibilityState={{ selected: category === c }}
            onPress={() => {
              setCategory(c);
              setNotice(null);
            }}
            style={[styles.tab, category === c && { borderBottomColor: colors.accent }]}
          >
            <Text style={[styles.tabText, { color: category === c ? colors.accent : colors.mutedText }]}>
              {c === 'daily' ? t.daily : t.longTerm}
            </Text>
          </Pressable>
        ))}
      </View>

      {notice ? (
        <Text style={[styles.notice, { color: colors.text, borderColor: colors.accent }]} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}

      <FlatList
        data={points}
        ListHeaderComponent={
          skyUnlocked(active) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.skyTitle}
              onPress={() => setSkyOpen(true)}
              style={[styles.skyCard, { borderColor: colors.accent }]}
            >
              <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 16 }}>✦ {t.skyTitle}</Text>
              <Text style={{ color: colors.mutedText, marginTop: 4 }}>{t.skyLine.replace('{n}', String(total))}</Text>
            </Pressable>
          ) : undefined
        }
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
        onPress={openAdd}
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
          const ok = editing
            ? await updatePoint(editing.id, value)
            : await createPoint({ ...value, language: settings.appLanguage });
          // A full category refuses the point; say so calmly instead of losing it silently.
          setNotice(ok ? null : limitMessage(value.category));
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
      <ReviewScreen visible={reviewOpen} pointIds={reviewIds} t={t} colors={colors} onClose={() => setReviewOpen(false)} />
      <SkyScreen visible={skyOpen} hideText={settings.privateNotifications} t={t} colors={colors} onClose={() => setSkyOpen(false)} />
      <PermissionSheet
        visible={permissionSheetOpen}
        t={t}
        colors={colors}
        onLater={() => setPermissionSheetOpen(false)}
        onAllow={() => {
          setPermissionSheetOpen(false);
          void (async () => {
            setPermission(await requestPermission());
            await syncReminders();
          })();
        }}
      />
      <ArchivedScreen
        visible={archivedOpen}
        t={t}
        colors={colors}
        onClose={() => setArchivedOpen(false)}
        onRestored={() => {
          void reload();
          void syncReminders();
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
  review: { marginLeft: 'auto', paddingVertical: 12, paddingHorizontal: 12 },
  archived: { paddingVertical: 12, paddingHorizontal: 12 },
  gear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  banner: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderWidth: 1, borderRadius: 12 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 16, fontWeight: '600' },
  list: { padding: 16, paddingBottom: 120, gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16 },
  cardText: { fontSize: 18, lineHeight: 26 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 16, paddingHorizontal: 24 },
  notice: { marginHorizontal: 16, marginTop: 8, padding: 12, borderWidth: 1, borderRadius: 12, fontSize: 15, lineHeight: 21 },
  skyCard: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 4 },
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  fabText: { fontSize: 30, lineHeight: 34 },
});
