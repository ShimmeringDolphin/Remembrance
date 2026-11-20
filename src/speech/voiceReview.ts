// Plays a voice script (core/labs/voice.ts) with expo-speech. Runs only while the user has pressed
// Listen and the app is open. Holds no timers or speech resources after it ends or is stopped.
import * as Speech from 'expo-speech';
import type { VoiceStep } from '../core/labs/voice';

export interface Playback {
  stop: () => void;
}

export function playScript(steps: readonly VoiceStep[], rate: number, onEnd: () => void): Playback {
  let index = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const finish = () => {
    if (stopped) return;
    stopped = true;
    onEnd();
  };
  const next = () => {
    if (stopped) return;
    const step = steps[index++];
    if (!step) return finish();
    if (step.kind === 'pause') {
      timer = setTimeout(next, step.ms);
      return;
    }
    Speech.speak(step.text, { language: step.locale, rate, onDone: next, onError: finish });
  };
  next();

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (timer) clearTimeout(timer);
      void Speech.stop();
      onEnd();
    },
  };
}

/** Languages (like "hi-IN") in the script that no installed voice covers, matched on the language part. */
export async function missingVoices(steps: readonly VoiceStep[]): Promise<string[]> {
  const wanted = new Set(steps.flatMap((s) => (s.kind === 'say' ? [s.locale] : [])));
  if (wanted.size === 0) return [];
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const have = new Set(voices.map((v) => v.language.toLowerCase().split(/[-_]/)[0]));
    return [...wanted].filter((l) => !have.has(l.toLowerCase().split(/[-_]/)[0]));
  } catch {
    return [];
  }
}
