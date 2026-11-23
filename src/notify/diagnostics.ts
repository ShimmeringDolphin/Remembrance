// Test-build panel data: how many reminders the phone holds and when the next ones are due.
// Reads only the due time of each; never point text. No timers or listeners: it runs when asked.
import * as Notifications from 'expo-notifications';

import { bookedTimes } from '../core/diagnostics';

export async function readBooked(): Promise<{ count: number; next: Date[] }> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const dues = all.map((n) => (n.content.data as { at?: unknown } | null)?.at);
  return { count: all.length, next: bookedTimes(dues).slice(0, 3) };
}
