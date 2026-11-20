import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { buildContent } from '../core/reminderContent';
import { planReminders } from '../core/scheduler';
import { type BookedReminder, countAppearances } from '../core/exposure';
import { getBooked, saveBooked } from '../db/booked';
import { addAppearances, listActivePoints } from '../db/points';
import { getSettings } from '../db/settings';
import { getStrings } from '../i18n/strings';

const CHANNEL_ID = 'reminders';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

/** Call once at startup. Reminders are shown quietly: no sound, no badge. */
export async function initNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    // Creating the channel must never stop the app from starting. If it fails (seen in Expo Go on
    // Android), notifications still show: the library falls back to its own default channel.
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    } catch (error) {
      console.warn('Could not create the reminders notification channel:', error);
    }
  }
}

export async function getPermissionState(): Promise<PermissionState> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestPermission(): Promise<PermissionState> {
  const p = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: false },
  });
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

let running = false;
let rerun = false;

/**
 * Rebuilds the booked notifications from the current points and settings. Safe to call often:
 * overlapping calls are merged into one follow-up run. While asleep, or without permission,
 * everything is cancelled so nothing stays scheduled.
 */
export async function syncReminders(): Promise<void> {
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  try {
    do {
      rerun = false;
      await syncOnce();
    } while (rerun);
  } finally {
    running = false;
  }
}

async function syncOnce(): Promise<void> {
  const settings = await getSettings();
  const now = new Date();
  const permission = await getPermissionState();
  // Before rebooking, count the reminders whose time has passed since last time. Without
  // permission they were not shown, so they are not counted.
  const previous = await getBooked();
  if (permission === 'granted') {
    const { counts, lastAt } = countAppearances(previous, now);
    await addAppearances(counts, lastAt);
  }
  // Forget the passed ones at once, so a failure below can never count them twice.
  await saveBooked(previous.filter((b) => Date.parse(b.at) > now.getTime()));
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.awake || permission !== 'granted') {
    await saveBooked([]);
    return;
  }

  const points = await listActivePoints();
  const plan = planReminders(points, settings, now);
  const booked: BookedReminder[] = [];
  const byId = new Map(points.map((p) => [p.id, p]));
  const t = getStrings(settings.appLanguage);
  const text = { title: t.appName, more: t.more, privateBody: t.privateBody, privateGroupedBody: t.privateGroupedBody };

  for (const reminder of plan) {
    const content = buildContent(reminder, byId, text, settings.privateNotifications);
    await Notifications.scheduleNotificationAsync({
      content: { title: content.title, body: content.body, data: content.data },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.at,
        channelId: CHANNEL_ID,
      },
    });
    booked.push({ at: reminder.at.toISOString(), pointIds: reminder.pointIds });
  }
  await saveBooked(booked);
}
