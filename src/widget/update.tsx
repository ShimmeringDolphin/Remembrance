// Fills the widget from the database. Runs when the app rebooks reminders and when Android asks
// for an update (at most hourly, see app.json). Reads only; never logs point text.
import { Platform } from 'react-native';
import { requestWidgetUpdate, type WidgetTaskHandler } from 'react-native-android-widget';

import { parseBooked } from '../core/appearances';
import { buildContent } from '../core/content';
import { parseShown } from '../core/moment';
import { mergeSettings } from '../core/settings';
import type { Category, Point } from '../core/types';
import { widgetSlot } from '../core/widget';
import { getValue, listPoints } from '../data/db';
import { deviceLanguage, strings } from '../i18n/strings';
import { dark, light } from '../theme/calmStudy';
import { keepWidget, WIDGET_NAME } from './KeepWidget';

async function render() {
  let settings = mergeSettings(null, deviceLanguage());
  try {
    const json = await getValue('settings');
    settings = mergeSettings(json ? JSON.parse(json) : null, deviceLanguage());
  } catch {
    // Defaults.
  }
  const t = strings(settings.language);
  let lines: string[] = [];
  // The category of each shown line, in the same order (null for the "+ N private" line); never any hidden words.
  let kinds: (Category | null)[] = [];
  try {
    const [points, booked, shown] = await Promise.all([listPoints(), getValue('booked'), getValue('lastShown')]);
    const live = new Map<string, Point>(points.filter((p) => !p.archived).map((p) => [p.id, p]));
    const slot = widgetSlot(parseBooked(booked), parseShown(shown), new Date());
    const ids = slot ? slot.pointIds.filter((id) => live.has(id)) : [];
    if (ids.length > 0) {
      const text = { title: t.notifTitle, privateOne: t.notifPrivateOne, privateMany: t.notifPrivateMany, privateExtra: t.notifPrivateExtra };
      lines = buildContent(ids, live, settings.privateMode, text).body.split('\n');
      kinds = ids.map((id) => live.get(id)!).filter((p) => !p.private && !settings.privateMode).map((p) => p.category);
    }
  } catch {
    // Show the empty card.
  }
  return keepWidget(t.notifTitle, lines, kinds, t.widgetEmpty, light, dark);
}

/** Redraws any widgets on the home screen. Does nothing on iPhone or when none is placed. */
export async function updateWidget(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: render });
  } catch {
    // No widget placed, or an old launcher; nothing to do.
  }
}

/** Android's own requests: placing, resizing and the periodic update. */
export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetInfo, widgetAction, renderWidget }) => {
  if (widgetInfo.widgetName !== WIDGET_NAME) return;
  if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE' || widgetAction === 'WIDGET_RESIZED') {
    renderWidget(await render());
  }
};
