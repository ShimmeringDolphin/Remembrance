// Reading aloud with the phone's own text-to-speech voice. Nothing is sent anywhere by the app.
// Speech starts only from a tap or a setting the user turned on, and is stopped when not needed.
import * as Speech from 'expo-speech';

import { playRuns, scriptRuns } from '../core/script';
import { pickVoice, type VoiceInfo } from '../core/voicePick';
import type { Language, Point } from '../core/types';
import { playRecording, stopRecordingPlayback } from './ownVoice';

// expo-speech on Android accepts only a bare language code here; a region such as "hi-IN" is rejected and the phone's default language is used instead.
const VOICE: Record<Language, string> = { en: 'en', hi: 'hi', gu: 'gu' };

// Only stopping bumps this, so a line being read is never cut off by the next one being queued.
let generation = 0;

/**
 * Speaks every text in turn, each part in the voice of its own script (English, Hindi, Gujarati), so lines that mix
 * them are read properly whatever the app language is. `language` is used only for text with no letters. The whole
 * list is one chain: each part waits for the one before it. `onEnd` runs when it finishes, is stopped, or fails.
 */
export function speakAll(texts: readonly string[], language: Language, onEnd?: () => void, gapMs = 0): void {
  const mine = generation;
  void phoneVoices().then((voices) => {
    if (mine !== generation) return onEnd?.();
    const chosen: Record<Language, string | undefined> = { en: pickVoice(voices, 'en'), hi: pickVoice(voices, 'hi'), gu: pickVoice(voices, 'gu') };
    const alive = () => mine === generation;
    // `gapMs` of quiet between two texts (one short timeout, only while reading; stopping makes it do nothing).
    const playText = (k: number) => {
      if (!alive() || k >= texts.length) return onEnd?.();
      playRuns(
        scriptRuns(texts[k], language),
        (run, done) => Speech.speak(run.text, { language: VOICE[run.language], voice: chosen[run.language], rate: 0.9, onDone: done, onStopped: done, onError: done }),
        alive,
        () => (gapMs > 0 && k + 1 < texts.length ? void setTimeout(() => playText(k + 1), gapMs) : playText(k + 1)),
      );
    };
    playText(0);
  });
}

/** The phone engine's voices (empty if it cannot say). Asked each time, because the user can change the engine. */
async function phoneVoices(): Promise<VoiceInfo[]> {
  try {
    return await Speech.getAvailableVoicesAsync();
  } catch {
    return [];
  }
}

/** The voice chosen for each language, for the test panel (undefined: none listed, the engine decides). */
export async function chosenVoices(): Promise<Record<Language, string | undefined>> {
  const voices = await phoneVoices();
  return { en: pickVoice(voices, 'en'), hi: pickVoice(voices, 'hi'), gu: pickVoice(voices, 'gu') };
}

/** Speaks one text; see `speakAll`. */
export function speak(text: string, language: Language, onEnd?: () => void): void {
  speakAll([text], language, onEnd);
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

/** How many voices the phone's current speech engine offers for each language (null if it cannot say). */
export async function voiceCounts(): Promise<Record<Language, number> | null> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const count = (code: string) => voices.filter((v) => v.language.toLowerCase().startsWith(code)).length;
    return { en: count('en'), hi: count('hi'), gu: count('gu') };
  } catch {
    return null;
  }
}

/** The languages in `text` that the phone has no voice for (empty if all are there or the phone cannot say). */
export async function missingVoices(text: string, language: Language): Promise<Language[]> {
  const counts = await voiceCounts();
  if (!counts) return [];
  const used = new Set(scriptRuns(text, language).map((r) => r.language));
  return [...used].filter((l) => counts[l] === 0);
}

/** Stops both the phone's voice and any recording. */
export function stopAll(): void {
  stopSpeaking();
  stopRecordingPlayback();
}
