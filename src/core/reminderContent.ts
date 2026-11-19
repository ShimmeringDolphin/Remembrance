import type { PlannedReminder } from './scheduler';
import type { Point } from './types';

export interface ContentText {
  title: string;
  /** Contains "{n}", replaced by the number of points. */
  groupedBody: string;
  /** Shown instead of the point text in private mode. */
  privateBody: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  data: { style: PlannedReminder['style']; pointIds: string[] };
}

/** Builds what a notification says. Private mode never puts point text on the lock screen. */
export function buildContent(
  reminder: PlannedReminder,
  pointsById: ReadonlyMap<string, Point>,
  text: ContentText,
  privateNotifications: boolean,
): NotificationPayload {
  const data = { style: reminder.style, pointIds: reminder.pointIds };
  if (reminder.style === 'grouped') {
    return { title: text.title, body: text.groupedBody.replace('{n}', String(reminder.pointIds.length)), data };
  }
  const point = pointsById.get(reminder.pointIds[0]);
  const hide = privateNotifications || point === undefined || point.private;
  return { title: text.title, body: hide ? text.privateBody : point.prompt, data };
}
