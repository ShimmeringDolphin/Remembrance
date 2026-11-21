// Reading aloud with the phone's own text-to-speech voice. Nothing is sent anywhere by the app.
// Speech starts only from a tap or a setting the user turned on, and is stopped when not needed.
import * as Speech from 'expo-speech';

import type { Language } from '../core/types';

const VOICE: Record<Language, string> = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' };

/** Speaks `text`; `onEnd` runs when it finishes, is stopped, or fails. */
export function speak(text: string, language: Language, onEnd?: () => void): void {
  let ended = false;
  const end = () => {
    if (!ended) {
      ended = true;
      onEnd?.();
    }
  };
  try {
    Speech.speak(text, { language: VOICE[language], rate: 0.9, onDone: end, onStopped: end, onError: end });
  } catch {
    end();
  }
}

export function stopSpeaking(): void {
  try {
    void Speech.stop();
  } catch {
    // Nothing was speaking.
  }
}
