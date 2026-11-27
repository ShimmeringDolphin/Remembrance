// YaadOM: write a short point once; it comes back to you through the day. See docs/PRODUCT.md.
import * as Notifications from 'expo-notifications';
import { loadAsync, useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, Share, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import type { Booked } from './src/core/appearances';
import { DEFAULT_DAILY_DAYS, expiryFor, resolveDays } from './src/core/expiry';
import { freshIds, idsFromData, listenQueue, listenSteps, momentPoints, parseShown } from './src/core/moment';
import { makeBackup, parseBackup, planRestore } from './src/core/backup';
import { markSeen, NO_TIPS_SEEN, parseTips, skipAll, tipsToString, type TipId, type TipState } from './src/core/tips';
import { VOICE_SAMPLES } from './src/core/voiceSamples';
import { goAsleep, startSession, statusFor, tapAwake, type AwakeAction } from './src/core/awake';
import { mergeSettings } from './src/core/settings';
import { skyUnlocked } from './src/core/sky';
import type { Category, Point, Settings } from './src/core/types';
import * as data from './src/data/db';
import { deviceLanguage, fill, strings } from './src/i18n/strings';
import { isSamsung, openBatterySettings } from './src/notify/phoneSettings';
import { dismissLateTip, lateTipNow } from './src/notify/timing';
import { deleteRecording } from './src/notify/ownVoice';
import { FontContext } from './src/ui/AppText';
import { fontFilesFor, fontFilesForSet } from './src/theme/fontFiles';
import { extraSetsNeeded, type FontSet } from './src/theme/fonts';
import { say, setEnglishInIndian, speakAll, speechDown, stopAll } from './src/notify/voice';
import { askPermission, dismissEmpty, dismissSeen, tidyShade, initNotifications, permission, syncReminders, type Permission } from './src/notify/reminders';
import { themeFor } from './src/theme/calmStudy';
import { updateWidget } from './src/widget/update';
import { HelpScreen } from './src/ui/HelpScreen';
import { MomentScreen } from './src/ui/MomentScreen';
import { Home } from './src/ui/Home';
import { PermissionSheet } from './src/ui/PermissionSheet';
import { SessionSheet, StartSheet } from './src/ui/SessionSheet';
import { PointSheet, type PointActions } from './src/ui/PointSheet';
import { SettingsScreen } from './src/ui/SettingsScreen';
import type { RestoreOutcome } from './src/ui/RestoreSheet';
import { SkyScreen } from './src/ui/SkyScreen';
import { Welcome } from './src/ui/Welcome';

type Screen = 'home' | 'settings' | 'sky' | 'help';

/** Test builds (Expo Go, or an APK built with EXPO_PUBLIC_TESTING=1) open the sky early. */
const TESTING = __DEV__ || process.env.EXPO_PUBLIC_TESTING === '1';

/** Quiet between two points when listening to all of them, so one does not run into the next. */
const LISTEN_GAP_MS = 1000;

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
  // Off until the saved tips are read, so a tip never flashes at start-up.
  const [tips, setTips] = useState<TipState>(skipAll());
  const [lateTip, setLateTip] = useState(false);
  const [lastShown, setLastShown] = useState<Booked | null>(null);
  const [momentIds, setMomentIds] = useState<string[] | null>(null);
  // The latest reminder the user has already gone through; its button hides until the next one.
  const [seenShown, setSeenShown] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const listenRun = useRef(0);
  const handled = useRef(new Set<string>());
  const response = Notifications.useLastNotificationResponse();
  // The pop-up for Awake outside the hours, and the start button a wake-up prompt opens.
  const [asking, setAsking] = useState<Extract<AwakeAction, { kind: 'ask' }> | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const settingsRef = useRef(settings);
  // Reminders are booked only after the saved settings have been read. Before that, settingsRef holds the
  // defaults (Awake), and booking with them would wake a phone that was put to sleep.
  const loadedRef = useRef(false);
  const t = strings(settings.language);
  // Bundled fonts for the app language only; until they load (or if they fail) the phone's own font is used.
  const [fontsLoaded] = useFonts(fontFilesFor(settings.language));
  // A point written in a script the app language's fonts lack (Hindi in a Gujarati app, Gujarati elsewhere) needs the other
  // set. It is loaded once, only when such a point exists, so most phones never hold both.
  const [extraLoaded, setExtraLoaded] = useState<FontSet[]>([]);
  const extraWanted = extraSetsNeeded(points.map((p) => p.text), settings.language).join();
  useEffect(() => {
    setExtraLoaded([]);
    if (!fontsLoaded || !extraWanted) return;
    let alive = true;
    const sets = extraWanted.split(',') as FontSet[];
    void Promise.all(sets.map((set) => loadAsync(fontFilesForSet(set))))
      .then(() => alive && setExtraLoaded(sets))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [fontsLoaded, extraWanted]);

  /** Books the reminders again and returns the latest reminder that has come. */
  const rebook = useCallback(async (s: Settings = settingsRef.current): Promise<Booked | null> => {
    if (!loadedRef.current) return null;
    try {
      await syncReminders(s);
    } catch {
      // Reminders are rebooked again on the next open; never surface point text in errors.
    }
    void updateWidget();
    try {
      setPoints(await data.listPoints());
      setRemindersPassed(Number(await data.getValue('remindersPassed')) || 0);
      const latest = parseShown(await data.getValue('lastShown'));
      setLastShown(latest);
      return latest;
    } catch {
      // Keep what is on screen.
      return null;
    }
  }, []);

  // The voice code reads this choice; no timers or listeners.
  useEffect(() => setEnglishInIndian(settings.englishInIndian), [settings.englishInIndian]);

  // Start-up: open the database, read settings, book reminders.
  useEffect(() => {
    (async () => {
      try {
        let s = readSettings(await data.getValue('settings'));
        // A phone that was put to sleep before prompts existed has no Asleep time: start counting now and keep it.
        if (s.asleep && !s.asleepSince) {
          s = { ...s, asleepSince: new Date().toISOString() };
          await data.setValue('settings', JSON.stringify(s));
        }
        settingsRef.current = s;
        loadedRef.current = true;
        setSettings(s);
        setWelcomed((await data.getValue('welcomed')) === '1');
        setAsked((await data.getValue('askedPermission')) === '1');
        setTipSeen((await data.getValue('batteryTipSeen')) === '1');
        setTips(parseTips(await data.getValue('tips')));
        setSeenShown(await data.getValue('seenShown'));
        setPoints(await data.listPoints());
        await initNotifications(strings(s.language).appName, strings(s.language).soundChannel);
        setPerm(await permission());
      } finally {
        setReady(true);
      }
      await rebook();
      setLateTip(await lateTipNow());
      void tidyShade(); // after the timing check, which reads the notifications still in the shade
    })();
  }, [rebook]);

  // Tapping a reminder opens its points as a moment, once per notification.
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const key = response.notification.request.identifier;
    if (handled.current.has(key)) return;
    handled.current.add(key);
    const content = response.notification.request.content.data;
    // A wake-up prompt only opens the start button; it never changes settings by itself.
    if ((content as { prompt?: unknown } | null)?.prompt === true) setStartOpen(true);
    const ids = idsFromData(content);
    if (ids.length > 0) setMomentIds(ids);
    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      // Older native code: the identifier guard above still prevents reopening.
    }
  }, [response]);

  // A tapped reminder whose points are all deleted or put away: say so, instead of silently showing Home.
  useEffect(() => {
    if (!ready || !momentIds || momentPoints(momentIds, points).length > 0) return;
    setMomentIds(null);
    Alert.alert(t.momentGone);
  }, [ready, momentIds, points]);

  // A reminder that arrives while the app is open: count it and move "latest" on to it.
  // One event listener, no polling; it fires only when a notification is shown.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {
      void tidyShade();
      void rebook();
    });
    return () => sub.remove();
  }, [rebook]);

  const openLatest = async () => {
    // Rebook first, so the button never opens an older reminder than the newest one that came.
    const latest = (await rebook()) ?? lastShown;
    if (!latest) return;
    setMomentIds(latest.pointIds);
    setSeenShown(latest.at);
    await data.setValue('seenShown', latest.at);
    void dismissSeen(latest.at);
  };

  const stopListening = useCallback(() => {
    listenRun.current++;
    setListening(false);
    stopAll();
  }, []);

  // Each run of points goes to the phone's voice at once, in order, and it reads them one after
  // another (waiting for each one stopped after the first point on some phones). Points recorded
  // in the user's own voice play one by one in between.
  const listen = () => {
    if (listening) return stopListening();
    const steps = listenSteps(listenQueue(points));
    if (steps.length === 0) return;
    const run = ++listenRun.current;
    // Silence from a lost link to the speech engine looks like a bug, so say so (once per tap).
    void speechDown().then((d) => d && steps.some((s) => s.kind !== 'own') && listenRun.current === run && Alert.alert(t.speechDown));
    stopAll();
    setListening(true);
    const next = (i: number) => {
      if (listenRun.current !== run) return;
      if (i >= steps.length) return stopListening();
      const step = steps[i];
      if (step.kind === 'own') return say(step.point, settingsRef.current.language, () => next(i + 1));
      speakAll(step.points.map((p) => p.text), settingsRef.current.language, () => next(i + 1), LISTEN_GAP_MS);
    };
    next(0);
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
      setLateTip(await lateTipNow());
      void tidyShade();
    });
    return () => sub.remove();
  }, [rebook, stopListening]);

  const changeSettings = async (s: Settings) => {
    const prev = settingsRef.current;
    settingsRef.current = s;
    loadedRef.current = true; // a choice made by the user is the newest word
    setSettings(s);
    const before = prev;
    await data.setValue('settings', JSON.stringify(s));
    // Turning read aloud or the English voice choice on or off changes no reminder, so skip the rebook; anything else rebooks.
    if (JSON.stringify({ ...before, readAloud: s.readAloud, englishInIndian: s.englishInIndian }) !== JSON.stringify(s)) await rebook(s);
  };

  /** Awake and Asleep. Asleep ends any session. Awake gives Daily points back the whole days spent Asleep. */
  const sleepOrWake = async (asleep: boolean) => {
    const now = new Date();
    const prev = settingsRef.current;
    setStartOpen(false);
    if (asleep) {
      setAsking(null);
      if (!prev.asleep) await changeSettings(goAsleep(prev, now));
      return;
    }
    const tap = tapAwake(prev, now);
    // Outside the hours, and not in the hour before the start: nothing changes until a span is chosen.
    if (tap.ask) {
      setAsking(tap.ask);
      return;
    }
    await wake(prev, now);
    await changeSettings(tap.settings);
  };

  /** Gives Daily points back the whole days spent Asleep. Called when Awake really happens. */
  const wake = async (prev: Settings, now: Date) => {
    if (!prev.asleep || !prev.asleepSince) return;
    try {
      await data.shiftDailyExpiry(prev, new Date(prev.asleepSince), now);
    } catch {
      // Points keep their dates; nothing is lost, they may just end sooner.
    }
  };

  const chooseSession = async (hours: number) => {
    const chosen = asking?.sessions[hours];
    setAsking(null);
    if (!chosen) return;
    const prev = settingsRef.current;
    await wake(prev, new Date());
    await changeSettings(startSession(prev, chosen));
  };

  const add = async (text: string, category: Category, days: number = DEFAULT_DAILY_DAYS): Promise<boolean> => {
    // More than 6 days is saved as Long-term, which never stops.
    const r = resolveDays(days);
    const cat: Category = category === 'daily' && r.longTerm ? 'long_term' : category;
    const expires = cat === 'daily' ? expiryFor(new Date(), r.days).toISOString() : null;
    const ok = await data.addPoint(text, cat, expires);
    if (ok) {
      await refresh();
      if (!asked && perm === 'undetermined') setAskNow(true);
      await rebook();
    }
    return ok;
  };

  // Backup: the user's points as text through the phone's share sheet. Nothing is sent by the app itself.
  const backUp = async () => {
    try {
      await Share.share({ message: makeBackup(await data.listPoints(), new Date()) });
    } catch {
      // The share sheet could not open; nothing was shared.
    }
  };
  const restore = async (text: string): Promise<RestoreOutcome> => {
    const parsed = parseBackup(text);
    if (!parsed.ok) return { ok: false };
    const plan = planRestore(await data.listPoints(), parsed.points, new Date());
    await data.restorePoints(plan.add);
    await refresh();
    await rebook();
    return { ok: true, message: fill(t.restoreDone, { added: plan.add.length, dupes: plan.duplicates + parsed.skipped, full: plan.full }) };
  };

  // Test builds only: adds one Long-term point for each language combination, to hear the voices.
  const addVoiceSamples = async () => {
    for (const text of VOICE_SAMPLES) await data.addPoint(text, 'long_term');
    await refresh();
    await rebook();
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

  // The first-run tips on Home: OK marks one seen, Skip tips switches them all off, Help can bring them back.
  const changeTips = async (next: TipState) => {
    setTips(next);
    await data.setValue('tips', tipsToString(next));
  };
  const answerTip = (action: 'got' | 'skip', id: TipId) => void changeTips(action === 'skip' ? skipAll() : markSeen(tips, id));

  const answerBatteryTip = async (open: boolean) => {
    setTipSeen(true);
    await data.setValue('batteryTipSeen', '1');
    if (open) await openBatterySettings();
  };

  // Show a change at once; rebooking the reminders can take a moment and runs after.
  const refresh = async () => {
    try {
      setPoints(await data.listPoints());
    } catch {
      // Keep what is on screen.
    }
  };

  const answerLateTip = async (open: boolean) => {
    setLateTip(false);
    await dismissLateTip();
    if (open) await openBatterySettings();
  };

  const act = (fn: () => Promise<unknown>) => async () => {
    const r = await fn();
    await refresh();
    await rebook();
    void dismissEmpty();
    return r;
  };
  const actions: PointActions = {
    edit: (id, text) => void act(() => data.editPoint(id, text))(),
    move: async (id, to) => (await act(() => data.movePoint(id, to))()) as boolean,
    setPrivate: (id, v) => void act(() => data.setPrivate(id, v))(),
    setPace: (id, pace) => void act(() => data.setPace(id, pace))(),
    // A new recording replaces the old file; removing one deletes it.
    setVoice: (id, voice) => {
      const old = points.find((p) => p.id === id)?.voice;
      void act(async () => {
        await data.setVoice(id, voice);
        if (old && old !== voice) deleteRecording(old);
      })();
    },
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
      const voice = points.find((p) => p.id === id)?.voice;
      void act(async () => {
        await data.deleteForGood(id);
        deleteRecording(voice);
      })();
    },
  };

  if (!ready) return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} /></SafeAreaProvider>;

  const showWelcome = !welcomed && points.length === 0;
  const moment = momentIds ? momentPoints(momentIds, points) : [];
  const inMoment = moment.length > 0;
  const fresh = freshIds(lastShown, new Date());
  return (
    <FontContext.Provider value={{ language: settings.language, ready: fontsLoaded, extra: extraLoaded }}>
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
            onClose={() => setMomentIds(null)}
          />
        ) : showWelcome ? (
          <Welcome t={t} theme={theme} language={settings.language} onLanguage={(language) => void changeSettings({ ...settings, language })} onKeep={keepFirst} />
        ) : screen === 'settings' ? (
          <SettingsScreen t={t} theme={theme} settings={settings} onChange={changeSettings} onBack={() => setScreen('home')} onGo={setScreen} onBackup={backUp} onRestore={restore} testing={TESTING} onSamples={TESTING ? addVoiceSamples : undefined} />
        ) : screen === 'help' ? (
          <HelpScreen t={t} theme={theme} onBack={() => setScreen('home')} onGo={setScreen} onTipsAgain={() => { void changeTips(NO_TIPS_SEEN); setScreen('home'); }} />
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
            onAsleep={(asleep) => void sleepOrWake(asleep)}
            status={statusFor(settings, new Date())}
            onLatestMoment={openLatest}
            latestNew={!!lastShown && lastShown.at !== seenShown}
            skyOpen={skyUnlocked(points, remindersPassed, TESTING)}
            batteryTip={Platform.OS === 'android' && perm === 'granted' && !tipSeen}
            onBatteryTip={answerBatteryTip}
            lateTip={lateTip}
            samsung={isSamsung}
            onLateTip={answerLateTip}
            onHelp={() => setScreen('help')}
            tips={tips}
            onTip={answerTip}
            permission={asked || perm !== 'undetermined' ? perm : 'granted'}
            onAdd={add}
            onOpen={setOpenId}
            onSettings={() => setScreen('settings')}
            onSky={() => setScreen('sky')}
            onTurnOn={turnOn}
          />
        )}
        <PointSheet everyCount={points.filter((p) => !p.archived && p.category === 'daily' && p.pace === 'every').length} point={points.find((p) => p.id === openId) ?? null} t={t} theme={theme} actions={actions} onClose={() => setOpenId(null)} />
        <SessionSheet asking={asking} t={t} theme={theme} from={settings.from} onChoose={(h) => void chooseSession(h)} onClose={() => setAsking(null)} />
        <StartSheet visible={startOpen && settings.asleep} t={t} theme={theme} onStart={() => void sleepOrWake(false)} onClose={() => setStartOpen(false)} />
        <PermissionSheet visible={askNow} t={t} theme={theme} from={settings.from} to={settings.to} onYes={() => answerPermission(true)} onLater={() => answerPermission(false)} />
      </SafeAreaView>
    </SafeAreaProvider>
    </FontContext.Provider>
  );
}
