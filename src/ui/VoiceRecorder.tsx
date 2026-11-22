// Record a point in your own voice. The microphone is on only between Record and Stop (30 s at
// most); the recording is kept on the phone and replaces the phone's voice for this point.
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import type { Point } from '../core/types';
import type { Strings } from '../i18n/strings';
import { audioMode, keepRecording, MAX_RECORDING_SECONDS, playRecording, stopRecordingPlayback } from '../notify/ownVoice';
import type { Theme } from '../theme/calmStudy';
import { Button } from './parts';

/** Mono at 64 kbps: about 240 KB for 30 seconds. */
const OPTIONS = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000 };

export function VoiceRecorder(props: {
  point: Point;
  t: Strings;
  theme: Theme;
  onSaved: (fileName: string) => void;
  onRemove: () => void;
}) {
  const { point: p, t, theme } = props;
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [denied, setDenied] = useState(false);
  const busy = useRef(false);
  // The status listener may keep the first render's values, so it reads this ref instead.
  const live = useRef(false);

  const finish = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) props.onSaved(await keepRecording(uri, p.id));
    } catch {
      // Nothing was kept; the old recording (if any) stays.
    } finally {
      live.current = false;
      setRecording(false);
      await audioMode(false);
      busy.current = false;
    }
  };

  const recorder = useAudioRecorder(OPTIONS, (s) => {
    // Reached the 30-second limit.
    if (s.isFinished && live.current && !busy.current) void finish();
  });

  // Never leave the microphone or a player running when the sheet closes.
  useEffect(
    () => () => {
      stopRecordingPlayback();
      try {
        if (recorder.isRecording) void recorder.stop();
      } catch {
        // Already stopped.
      }
      void audioMode(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const start = async () => {
    stopRecordingPlayback();
    setPlaying(false);
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setDenied(true);
      return;
    }
    setDenied(false);
    try {
      await audioMode(true);
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: MAX_RECORDING_SECONDS });
      live.current = true;
      setRecording(true);
    } catch {
      setRecording(false);
      await audioMode(false);
    }
  };

  const play = () => {
    if (!p.voice) return;
    if (playing) {
      stopRecordingPlayback();
      return;
    }
    setPlaying(true);
    playRecording(p.voice, () => setPlaying(false));
  };

  return (
    <View style={[styles.box, { borderColor: theme.line }]}>
      <Text style={[styles.label, { color: theme.text }]}>{t.ownVoice}</Text>
      <Text style={[styles.muted, { color: theme.muted }]}>{recording ? t.recordingNow : p.voice ? t.ownVoiceHas : t.ownVoiceHint}</Text>
      {recording ? (
        <Button label={t.stopRecording} theme={theme} onPress={() => void finish()} />
      ) : (
        <View style={styles.row}>
          <Button label={p.voice ? t.recordAgain : t.record} theme={theme} kind="plain" onPress={() => void start()} />
          {p.voice && <Button label={playing ? t.stopPlaying : t.playVoice} theme={theme} kind="plain" onPress={play} />}
          {p.voice && (
            <Button
              label={t.removeVoice}
              theme={theme}
              kind="quiet"
              onPress={() => {
                stopRecordingPlayback();
                setPlaying(false);
                props.onRemove();
              }}
            />
          )}
        </View>
      )}
      {denied && <Button label={t.micDenied} theme={theme} kind="quiet" onPress={() => void Linking.openSettings()} />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontSize: 17, fontWeight: '700' },
  muted: { fontSize: 15, lineHeight: 21 },
});
