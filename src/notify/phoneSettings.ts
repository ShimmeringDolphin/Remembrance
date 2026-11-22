// Opens the phone's own settings pages. No permissions needed; nothing is read or changed by the app.
import { Linking, Platform } from 'react-native';

/** Samsung phones have their own "sleeping apps" list, apart from Android's battery optimisation. */
export const isSamsung = Platform.OS === 'android' && /samsung/i.test(String((Platform.constants as { Manufacturer?: string }).Manufacturer ?? ''));

/** Android: the list of apps and their battery use. Elsewhere, this app's settings page. */
export async function openBatterySettings(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
      return;
    } catch {
      // Some phones do not have this page; fall back to the app's own settings.
    }
  }
  await openAppSettings();
}

/** This app's page in the phone's settings, where notifications are turned on or off. */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Nothing more we can do; the Help page explains where to look.
  }
}
