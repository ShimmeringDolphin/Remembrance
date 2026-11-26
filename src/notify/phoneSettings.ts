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

/** Tries each Android settings action in turn and stops at the first that opens; the last resort is this app's page. */
async function openFirst(actions: readonly string[]): Promise<void> {
  if (Platform.OS === 'android') {
    for (const action of actions) {
      try {
        await Linking.sendIntent(action);
        return;
      } catch {
        // This phone has no such page; try the next one.
      }
    }
  }
  await openAppSettings();
}

/** Android's text-to-speech page (engine, speed, voices); the phone's main Settings if it has no such page. */
export const openSpeechSettings = (): Promise<void> => openFirst(['com.android.settings.TTS_SETTINGS', 'android.settings.SETTINGS']);

/** Asks the phone's speech engine to show its own "install voice data" screen (a public Android action). */
export const openVoiceDownload = (): Promise<void> => openFirst(['android.speech.tts.engine.INSTALL_TTS_DATA', 'com.android.settings.TTS_SETTINGS', 'android.settings.SETTINGS']);
