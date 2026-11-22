// Checks, when the app opens, whether reminders really arrived on time. Android only.
// It reads the notifications still in the tray (each carries the time it was due) and compares the
// time the phone posted them. No timer, no listener, no network; only times are looked at, never words.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { arrivals, judgeTiming, showTimingTip } from '../core/lateness';
import { getValue, setValue } from '../data/db';

/** Whether to show the "reminders came late" tip now. */
export async function lateTipNow(now: Date = new Date()): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    const timing = judgeTiming(arrivals(shown.map((n) => ({ date: n.date, data: n.request.content.data }))), now);
    const dismissed = Number(await getValue('lateTipDismissed')) || null;
    return showTimingTip(timing, dismissed, now);
  } catch {
    return false;
  }
}

export async function dismissLateTip(now: Date = new Date()): Promise<void> {
  await setValue('lateTipDismissed', String(now.getTime()));
}
