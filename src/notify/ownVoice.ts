// The user's own recorded voice for a point. Recordings stay in the app's private documents folder
// (not encrypted, like the points themselves) and are never sent anywhere. The microphone is used
// only while the user holds a recording open; one player at a time, released as soon as it ends.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';

/** Longest recording, in seconds: a short point should not need more. */
export const MAX_RECORDING_SECONDS = 30;

const folder = () => new Directory(Paths.document, 'voices');
const fileFor = (name: string) => new File(folder(), name);

/** Moves a finished recording into the voices folder and returns its file name. */
export async function keepRecording(tempUri: string, pointId: string): Promise<string> {
  const dir = folder();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const ext = tempUri.split('.').pop()?.toLowerCase();
  const name = `${pointId.replace(/[^a-z0-9-]/gi, '')}-${Date.now().toString(36)}.${ext && ext.length <= 4 ? ext : 'm4a'}`;
  await new File(tempUri).move(fileFor(name));
  return name;
}

export function deleteRecording(name: string | null | undefined): void {
  if (!name) return;
  try {
    const f = fileFor(name);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}

let current: { player: AudioPlayer; end: () => void } | null = null;

/** Plays a recording; `onEnd` runs when it finishes, is stopped, or fails. */
export function playRecording(name: string, onEnd?: () => void): void {
  stopRecordingPlayback();
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    if (current?.end === end) {
      try {
        current.player.remove();
      } catch {
        // Already released.
      }
      current = null;
    }
    onEnd?.();
  };
  try {
    const f = fileFor(name);
    if (!f.exists) return end();
    const player = createAudioPlayer(f.uri);
    current = { player, end };
    player.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish) end();
    });
    player.play();
  } catch {
    end();
  }
}

export function stopRecordingPlayback(): void {
  const c = current;
  if (!c) return;
  try {
    c.player.pause();
  } catch {
    // Nothing was playing.
  }
  c.end();
}

/** Recording needs the audio session in record mode; playback goes back to normal afterwards. */
export async function audioMode(recording: boolean): Promise<void> {
  try {
    await setAudioModeAsync({ allowsRecording: recording, playsInSilentMode: true, shouldPlayInBackground: false });
  } catch {
    // Older devices: the defaults still play.
  }
}
