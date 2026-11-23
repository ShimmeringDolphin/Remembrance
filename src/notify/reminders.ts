// Books reminders with the OS. No timers, no background task: this runs only when the app opens or
// comes to the front, and after a point or setting changes. Everything after that is the OS's job.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { bookReminders } from '../core/booking';
import { reminderData } from '../core/lateness';
import { MAX_BOOKED, MAX_BOOKED_ANDROID } from '../core/planner';
import { serialLatest } from '../core/serialLatest';
import type { Settings } from '../core/types';
import { getValue, listPoints, putAwayExpired, recordAppearances } from '../data/db';
import { strings } from '../i18n/strings';
import { categoryColour } from '../theme/calmStudy';

const CHANNEL = 'points';
/** Android fixes a channel's sound when it is created, so the chime needs a channel of its own. */
const SOUND_CHANNEL = 'points-gentle';
/** Bundled by the expo-notifications plugin (app.json "sounds"). */
const SOUND_FILE = 'gentle.wav';

/** Shows reminders quietly even while the app is open. Call once at start-up. */
export async function initNotifications(channelName: string, soundChannelName: string): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: channelName,
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
        vibrationPattern: null,
        enableVibrate: false,
      });
      await Notifications.setNotificationChannelAsync(SOUND_CHANNEL, {
        name: soundChannelName,
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: SOUND_FILE,
        vibrationPattern: null,
        enableVibrate: false,
      });
    } catch {
      // A missing channel only means Android uses its default; reminders still work.
    }
  }
}

export type Permission = 'granted' | 'denied' | 'undetermined';

export async function permission(): Promise<Permission> {
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'undetermined';
  }
}

export async function askPermission(): Promise<Permission> {
  try {
    const p = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: false } });
    return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Rebooks every reminder. One run at a time; a call that arrives during a run makes one more run with the newest settings. */
export const syncReminders = serialLatest<Settings>((settings) => rebook(settings));

async function rebook(settings: Settings): Promise<void> {
  const t = strings(settings.language);
  const text = { title: t.notifTitle, privateOne: t.notifPrivateOne, privateMany: t.notifPrivateMany, privateExtra: t.notifPrivateExtra };
  const limit = Platform.OS === 'android' ? MAX_BOOKED_ANDROID : MAX_BOOKED;
  await bookReminders(
    {
      readBooked: () => getValue('booked'),
      listPoints,
      putAwayExpired,
      permissionGranted: async () => (await Notifications.getPermissionsAsync()).granted,
      cancelAll: () => Notifications.cancelAllScheduledNotificationsAsync(),
      countBooked: async () => (await Notifications.getAllScheduledNotificationsAsync()).length,
      schedule: async (r) => {
        await Notifications.scheduleNotificationAsync({
          // Only ids and the due time travel with the notification, never point text beyond what the body already shows.
          content: { title: r.title, body: r.body, sound: settings.sound ? SOUND_FILE : false, color: categoryColour(r.category), data: reminderData(r) },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: settings.sound ? SOUND_CHANNEL : CHANNEL },
        });
      },
      record: recordAppearances,
    },
    settings,
    new Date(),
    limit,
    text,
  );
}
