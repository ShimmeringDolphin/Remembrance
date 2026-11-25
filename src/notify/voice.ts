// Reading aloud with the phone's own text-to-speech voice. Nothing is sent anywhere by the app.
// Speech starts only from a tap or a setting the user turned on, and is stopped when not needed.
import * as Speech from 'expo-speech';

import { scriptRuns } from '../core/script';
import type { Language, Point } from '../core/types';
import { playRecording, stopRecordingPlayback } from './ownVoice';

// expo-speech on Android accepts only a bare language code here; a region such as "hi-IN" is rejected and the phone's default language is used instead.
const VOICE: Record<Language, string> = { en: 'en', hi: 'hi', gu: 'gu' };

let generation = 0;

/**
 * Speaks `text`, each part in the voice of its own script (English, Hindi, Gujarati), one after another, so a
 * line that mixes them is read properly whatever the app language is. `language` is used only when the text has
 * no letters. `onEnd` runs when it finishes, is stopped, or fails.
 */
export function speak(text: string, language: Language, onEnd?: () => void): void {
  const mine = ++generation;
  const runs = scriptRuns(text, language);
  let ended = false;
  const end = () => {
    if (!ended) {
      ended = true;
      onEnd?.();
    }
  };
  const next = (i: number) => {
    if (mine !== generation || i >= runs.length) return end();
    try {
      Speech.speak(runs[i].text, { language: VOICE[runs[i].language], rate: 0.9, onDone: () => next(i + 1), onStopped: end, onError: end });
    } catch {
      end();
    }
  };
  next(0);
}

export function stopSpeaking(): void {
  generation++;
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
