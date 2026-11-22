// Reading aloud with the phone's own text-to-speech voice. Nothing is sent anywhere by the app.
// Speech starts only from a tap or a setting the user turned on, and is stopped when not needed.
import * as Speech from 'expo-speech';

import type { Language, Point } from '../core/types';
import { playRecording, stopRecordingPlayback } from './ownVoice';

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

/** Reads a point: in the user's own recorded voice if it has one, otherwise the phone's voice. */
export function say(p: Pick<Point, 'text' | 'voice'>, language: Language, onEnd?: () => void): void {
  if (p.voice) playRecording(p.voice, onEnd);
  else speak(p.text, language, onEnd);
}

/** Stops both the phone's voice and any recording. */
export function stopAll(): void {
  stopSpeaking();
  stopRecordingPlayback();
}
