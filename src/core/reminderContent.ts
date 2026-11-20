import type { PlannedReminder } from './scheduler';
import type { Point } from './types';

export interface ContentText {
  title: string;
  /** Last line when not every point fits. Contains "{n}". */
  more: string;
  /** Shown instead of one point's text in private mode. */
  privateBody: string;
  /** Shown instead of several points' text in private mode. Contains "{n}". */
  privateGroupedBody: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  data: { style: PlannedReminder['style']; pointIds: string[] };
}

/** Most point lines in one grouped notification; phones show about this many when expanded. */
export const MAX_LINES = 4;

/**
 * Builds what a notification says. A reminder is complete on its own: it shows the points
 * themselves, so reading it is enough (docs/PRODUCT.md). Private mode and private points never put
 * text on the lock screen. In grouped reminders a different point leads each hour, so no point
 * is always hidden at the bottom.
 */
export function buildContent(
  reminder: PlannedReminder,
  pointsById: ReadonlyMap<string, Point>,
  text: ContentText,
  privateNotifications: boolean,
): NotificationPayload {
  const data = { style: reminder.style, pointIds: reminder.pointIds };
  const count = reminder.pointIds.length;
  const hidden = (n: number) => (n === 1 ? text.privateBody : text.privateGroupedBody.replace('{n}', String(n)));

  if (reminder.style === 'grouped') {
    const visible = privateNotifications
      ? []
      : reminder.pointIds.flatMap((id) => {
          const p = pointsById.get(id);
          return p && !p.private ? [p.prompt] : [];
        });
    if (visible.length === 0) return { title: text.title, body: hidden(count), data };
    const lead = Math.round(reminder.at.getTime() / 3600000) % visible.length;
    const rotated = [...visible.slice(lead), ...visible.slice(0, lead)];
    const lines = rotated.slice(0, MAX_LINES);
    const rest = count - lines.length;
    if (rest > 0) lines.push(text.more.replace('{n}', String(rest)));
    return { title: text.title, body: lines.join('\n'), data };
  }
  const point = pointsById.get(reminder.pointIds[0]);
  const hide = privateNotifications || point === undefined || point.private;
  return { title: text.title, body: hide ? text.privateBody : point.prompt, data };
}
