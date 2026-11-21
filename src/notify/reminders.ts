// Books reminders with the OS. No timers, no background task: this runs only when the app opens or
// comes to the front, and after a point or setting changes. Everything after that is the OS's job.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { countAppearances, parseBooked, type Booked } from '../core/appearances';
import { buildContent } from '../core/content';
import { planSlots } from '../core/planner';
import type { Point, Settings } from '../core/types';
import { getValue, listPoints, recordAppearances } from '../data/db';
import { strings } from '../i18n/strings';

const CHANNEL = 'points';

/** Shows reminders quietly even while the app is open. Call once at start-up. */
export async function initNotifications(channelName: string): Promise<void> {
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

let running: Promise<void> | null = null;
let again = false;

/** Rebooks every reminder. Calls that arrive while one is running are folded into one more run. */
export function syncReminders(settings: Settings): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    let s = settings;
    do {
      again = false;
      await rebook(s);
      s = latest ?? s;
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

let latest: Settings | null = null;
/** Lets a run in progress pick up settings that changed while it ran. */
export const noteSettings = (s: Settings) => {
  latest = s;
};

async function rebook(settings: Settings): Promise<void> {
  const now = new Date();
  const booked = parseBooked(await getValue('booked'));
  const { counts, lastAt } = countAppearances(booked, now);

  await Notifications.cancelAllScheduledNotificationsAsync();

  const points = await listPoints();
  const future: Booked[] = [];
  if ((await permission()) === 'granted') {
    const byId = new Map<string, Point>(points.map((p) => [p.id, p]));
    const t = strings(settings.language);
    const text = { title: t.notifTitle, privateOne: t.notifPrivateOne, privateMany: t.notifPrivateMany, privateExtra: t.notifPrivateExtra };
    for (const slot of planSlots(points, settings, now)) {
      const content = buildContent(slot.pointIds, byId, settings.privateMode, text);
      try {
        await Notifications.scheduleNotificationAsync({
          content: { title: content.title, body: content.body, sound: false },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: slot.at, channelId: CHANNEL },
        });
        future.push({ at: slot.at.toISOString(), pointIds: slot.pointIds });
      } catch {
        // Skip this one; the next rebook tries again. Never log the point text.
      }
    }
  }
  await recordAppearances(counts, lastAt, future);
}
