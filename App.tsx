// YaadOM: write a short point once; it comes back to you through the day. See docs/PRODUCT.md.
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { mergeSettings } from './src/core/settings';
import { skyUnlocked } from './src/core/sky';
import type { Category, Point, Settings } from './src/core/types';
import * as data from './src/data/db';
import { deviceLanguage, strings } from './src/i18n/strings';
import { openBatterySettings } from './src/notify/phoneSettings';
import { askPermission, initNotifications, noteSettings, permission, syncReminders, type Permission } from './src/notify/reminders';
import { themeFor } from './src/theme/calmStudy';
import { HelpScreen } from './src/ui/HelpScreen';
import { Home } from './src/ui/Home';
import { PermissionSheet } from './src/ui/PermissionSheet';
import { PointSheet, type PointActions } from './src/ui/PointSheet';
import { SettingsScreen } from './src/ui/SettingsScreen';
import { SkyScreen } from './src/ui/SkyScreen';
import { Welcome } from './src/ui/Welcome';

type Screen = 'home' | 'settings' | 'sky' | 'help';

function readSettings(json: string | null): Settings {
  try {
    return mergeSettings(json ? JSON.parse(json) : null, deviceLanguage());
  } catch {
    return mergeSettings(null, deviceLanguage());
  }
}

export default function App() {
  const theme = themeFor(useColorScheme());
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => mergeSettings(null, deviceLanguage()));
  const [points, setPoints] = useState<Point[]>([]);
  const [welcomed, setWelcomed] = useState(false);
  const [asked, setAsked] = useState(false);
  const [perm, setPerm] = useState<Permission>('undetermined');
  const [screen, setScreen] = useState<Screen>('home');
  const [openId, setOpenId] = useState<string | null>(null);
  const [askNow, setAskNow] = useState(false);
  const [remindersPassed, setRemindersPassed] = useState(0);
  const [tipSeen, setTipSeen] = useState(true);
  const settingsRef = useRef(settings);
  const t = strings(settings.language);

  const rebook = useCallback(async (s: Settings = settingsRef.current) => {
    try {
      await syncReminders(s);
    } catch {
      // Reminders are rebooked again on the next open; never surface point text in errors.
    }
    try {
      setPoints(await data.listPoints());
      setRemindersPassed(Number(await data.getValue('remindersPassed')) || 0);
    } catch {
      // Keep what is on screen.
    }
  }, []);

  // Start-up: open the database, read settings, book reminders.
  useEffect(() => {
    (async () => {
      try {
        const s = readSettings(await data.getValue('settings'));
        settingsRef.current = s;
        setSettings(s);
        setWelcomed((await data.getValue('welcomed')) === '1');
        setAsked((await data.getValue('askedPermission')) === '1');
        setTipSeen((await data.getValue('batteryTipSeen')) === '1');
        setPoints(await data.listPoints());
        await initNotifications(strings(s.language).appName);
        setPerm(await permission());
      } finally {
        setReady(true);
      }
      await rebook();
    })();
  }, [rebook]);

  // Coming back to the app: the user may have changed notification permission or let reminders pass.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      setPerm(await permission());
      await rebook();
    });
    return () => sub.remove();
  }, [rebook]);

  const changeSettings = async (s: Settings) => {
    settingsRef.current = s;
    noteSettings(s);
    setSettings(s);
    await data.setValue('settings', JSON.stringify(s));
    await rebook(s);
  };

  const add = async (text: string, category: Category): Promise<boolean> => {
    const ok = await data.addPoint(text, category);
    if (ok) {
      if (!asked && perm === 'undetermined') setAskNow(true);
      await rebook();
    }
    return ok;
  };

  const keepFirst = async (text: string) => {
    await data.setValue('welcomed', '1');
    setWelcomed(true);
    await add(text, 'daily');
  };

  const answerPermission = async (yes: boolean) => {
    setAskNow(false);
    setAsked(true);
    await data.setValue('askedPermission', '1');
    if (yes) setPerm(await askPermission());
    await rebook();
  };

  const turnOn = async () => {
    if (perm === 'denied') {
      await Linking.openSettings();
      return;
    }
    setPerm(await askPermission());
    await rebook();
  };

  const answerBatteryTip = async (open: boolean) => {
    setTipSeen(true);
    await data.setValue('batteryTipSeen', '1');
    if (open) await openBatterySettings();
  };

  const act = (fn: () => Promise<unknown>) => async () => {
    const r = await fn();
    await rebook();
    return r;
  };
  const actions: PointActions = {
    edit: (id, text) => void act(() => data.editPoint(id, text))(),
    move: async (id, to) => (await act(() => data.movePoint(id, to))()) as boolean,
    setPrivate: (id, v) => void act(() => data.setPrivate(id, v))(),
    putAway: (id) => {
      setOpenId(null);
      void act(() => data.putAway(id))();
    },
    bringBack: async (id) => {
      const ok = (await act(() => data.bringBack(id))()) as boolean;
      if (ok) setOpenId(null);
      return ok;
    },
    deleteForGood: (id) => {
      setOpenId(null);
      void act(() => data.deleteForGood(id))();
    },
  };

  if (!ready) return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} /></SafeAreaProvider>;

  const showWelcome = !welcomed && points.length === 0;
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: screen === 'sky' ? theme.sky : theme.background }}>
        <StatusBar style={screen === 'sky' ? 'light' : 'auto'} />
        {showWelcome ? (
          <Welcome t={t} theme={theme} onKeep={keepFirst} />
        ) : screen === 'settings' ? (
          <SettingsScreen t={t} theme={theme} settings={settings} onChange={changeSettings} onBack={() => setScreen('home')} />
        ) : screen === 'help' ? (
          <HelpScreen t={t} theme={theme} onBack={() => setScreen('home')} />
        ) : screen === 'sky' ? (
          <SkyScreen t={t} theme={theme} points={points} onBack={() => setScreen('home')} />
        ) : (
          <Home
            t={t}
            theme={theme}
            points={points}
            paused={settings.paused}
            skyOpen={skyUnlocked(points, remindersPassed, __DEV__)}
            batteryTip={Platform.OS === 'android' && perm === 'granted' && !tipSeen}
            onBatteryTip={answerBatteryTip}
            onHelp={() => setScreen('help')}
            permission={asked || perm !== 'undetermined' ? perm : 'granted'}
            onAdd={add}
            onOpen={setOpenId}
            onSettings={() => setScreen('settings')}
            onSky={() => setScreen('sky')}
            onResume={() => changeSettings({ ...settings, paused: false })}
            onTurnOn={turnOn}
          />
        )}
        <PointSheet point={points.find((p) => p.id === openId) ?? null} t={t} theme={theme} actions={actions} onClose={() => setOpenId(null)} />
        <PermissionSheet visible={askNow} t={t} theme={theme} from={settings.from} to={settings.to} onYes={() => answerPermission(true)} onLater={() => answerPermission(false)} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
