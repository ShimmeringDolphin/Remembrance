// YaadOM: write a short point once; it comes back to you through the day. See docs/PRODUCT.md.
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import type { Booked } from './src/core/appearances';
import { DEFAULT_DAILY_DAYS, expiryFor, resolveDays } from './src/core/expiry';
import { freshIds, idsFromData, listenQueue, momentPoints, parseShown } from './src/core/moment';
import { mergeSettings } from './src/core/settings';
import { skyUnlocked } from './src/core/sky';
import type { Category, Point, Settings } from './src/core/types';
import * as data from './src/data/db';
import { deviceLanguage, strings } from './src/i18n/strings';
import { openBatterySettings } from './src/notify/phoneSettings';
import { speak, stopSpeaking } from './src/notify/voice';
import { askPermission, initNotifications, noteSettings, permission, syncReminders, type Permission } from './src/notify/reminders';
import { themeFor } from './src/theme/calmStudy';
import { HelpScreen } from './src/ui/HelpScreen';
import { MomentScreen } from './src/ui/MomentScreen';
import { Home } from './src/ui/Home';
import { PermissionSheet } from './src/ui/PermissionSheet';
import { PointSheet, type PointActions } from './src/ui/PointSheet';
import { SettingsScreen } from './src/ui/SettingsScreen';
import { SkyScreen } from './src/ui/SkyScreen';
import { Welcome } from './src/ui/Welcome';

type Screen = 'home' | 'settings' | 'sky' | 'help';

/** Test builds (Expo Go, or an APK built with EXPO_PUBLIC_TESTING=1) open the sky early. */
const TESTING = __DEV__ || process.env.EXPO_PUBLIC_TESTING === '1';

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
  const [lastShown, setLastShown] = useState<Booked | null>(null);
  const [momentIds, setMomentIds] = useState<string[] | null>(null);
  const [listening, setListening] = useState(false);
  const listenRun = useRef(0);
  const handled = useRef(new Set<string>());
  const response = Notifications.useLastNotificationResponse();
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
      setLastShown(parseShown(await data.getValue('lastShown')));
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

  // Tapping a reminder opens its points as a moment, once per notification.
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const key = response.notification.request.identifier;
    if (handled.current.has(key)) return;
    handled.current.add(key);
    const ids = idsFromData(response.notification.request.content.data);
    if (ids.length > 0) setMomentIds(ids);
    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      // Older native code: the identifier guard above still prevents reopening.
    }
  }, [response]);

  const stopListening = useCallback(() => {
    listenRun.current++;
    setListening(false);
    stopSpeaking();
  }, []);

  // Every point is handed to the phone's voice at once, in order; it reads them one after another.
  // (Waiting for each one to finish before starting the next stopped after the first point on some phones.)
  const listen = () => {
    if (listening) return stopListening();
    const queue = listenQueue(points);
    if (queue.length === 0) return;
    const run = ++listenRun.current;
    stopSpeaking();
    setListening(true);
    queue.forEach((p, i) => {
      const last = i === queue.length - 1;
      speak(p.text, settingsRef.current.language, last ? () => listenRun.current === run && stopListening() : undefined);
    });
  };

  // Coming back to the app: the user may have changed notification permission or let reminders pass.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') {
        // Release the voice when the app leaves the screen.
        stopListening();
        return;
      }
      setPerm(await permission());
      await rebook();
    });
    return () => sub.remove();
  }, [rebook, stopListening]);

  const changeSettings = async (s: Settings) => {
    const prev = settingsRef.current;
    settingsRef.current = s;
    noteSettings(s);
    setSettings(s);
    const before = prev;
    await data.setValue('settings', JSON.stringify(s));
    // Turning the voice on or off changes no reminder, so skip the rebook.
    const sameReminders = (['from', 'to', 'every', 'asleep', 'privateMode', 'language'] as const).every((k) => before[k] === s[k]);
    if (!sameReminders) await rebook(s);
  };

  const add = async (text: string, category: Category, days: number = DEFAULT_DAILY_DAYS): Promise<boolean> => {
    // More than 6 days is saved as Long-term, which never stops.
    const r = resolveDays(days);
    const cat: Category = category === 'daily' && r.longTerm ? 'long_term' : category;
    const expires = cat === 'daily' ? expiryFor(new Date(), r.days).toISOString() : null;
    const ok = await data.addPoint(text, cat, expires);
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
    setPace: (id, pace) => void act(() => data.setPace(id, pace))(),
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
  const moment = momentIds ? momentPoints(momentIds, points) : [];
  const inMoment = moment.length > 0;
  const fresh = freshIds(lastShown, new Date());
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: screen === 'sky' ? theme.sky : theme.background }}>
        <StatusBar style={screen === 'sky' ? 'light' : 'auto'} />
        {inMoment ? (
          <MomentScreen
            key={momentIds!.join('|')}
            t={t}
            theme={theme}
            language={settings.language}
            moment={moment}
            allPoints={points}
            readAloud={settings.readAloud}
            onReadAloud={(on) => changeSettings({ ...settings, readAloud: on })}
            onClose={() => setMomentIds(null)}
          />
        ) : showWelcome ? (
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
            asleep={settings.asleep}
            fresh={fresh}
            listening={listening}
            onListen={listen}
            onAsleep={(asleep) => changeSettings({ ...settings, asleep })}
            onLatestMoment={() => lastShown && setMomentIds(lastShown.pointIds)}
            skyOpen={skyUnlocked(points, remindersPassed, TESTING)}
            batteryTip={Platform.OS === 'android' && perm === 'granted' && !tipSeen}
            onBatteryTip={answerBatteryTip}
            onHelp={() => setScreen('help')}
            permission={asked || perm !== 'undetermined' ? perm : 'granted'}
            onAdd={add}
            onOpen={setOpenId}
            onSettings={() => setScreen('settings')}
            onSky={() => setScreen('sky')}
            onTurnOn={turnOn}
          />
        )}
        <PointSheet point={points.find((p) => p.id === openId) ?? null} t={t} theme={theme} actions={actions} onClose={() => setOpenId(null)} />
        <PermissionSheet visible={askNow} t={t} theme={theme} from={settings.from} to={settings.to} onYes={() => answerPermission(true)} onLater={() => answerPermission(false)} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
