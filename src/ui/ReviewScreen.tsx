import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildVoiceScript } from '../core/labs/voice';
import type { Point } from '../core/types';
import { missingVoices, playScript, type Playback } from '../speech/voiceReview';
import { listForReview } from '../db/points';
import type { Strings } from '../i18n/strings';
import type { calmStudy } from '../theme/calmStudy';

type Colors = (typeof calmStudy)['light'] | (typeof calmStudy)['dark'];

interface Props {
  visible: boolean;
  /** Ids from a tapped reminder; empty means every active point (newest first, capped). */
  pointIds: readonly string[];
  t: Strings;
  colors: Colors;
  voiceEnabled: boolean;
  speechRate: number;
  /** Private mode: nothing is spoken aloud. */
  hideText: boolean;
  onAnswer: (point: Point, answer: 'remembered' | 'again_soon') => Promise<void>;
  onClose: () => void;
}

/** Shows the points to read now. Loads only the points on this screen and nothing stays cached. */
export function ReviewScreen({ visible, pointIds, t, colors, voiceEnabled, speechRate, hideText, onAnswer, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [points, setPoints] = useState<Point[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const playback = useRef<Playback | null>(null);

  const stopSpeaking = () => {
    playback.current?.stop();
    playback.current = null;
  };
  // Leaving the screen always stops speech and drops the player.
  useEffect(() => {
    if (!visible) {
      stopSpeaking();
      setSpeaking(false);
      setMissing([]);
    }
    return stopSpeaking;
  }, [visible]);

  const toggleListen = async () => {
    if (speaking) {
      stopSpeaking();
      return;
    }
    const { steps } = buildVoiceScript(points, hideText);
    setMissing(await missingVoices(steps));
    setSpeaking(true);
    playback.current = playScript(steps, speechRate, () => {
      playback.current = null;
      setSpeaking(false);
    });
  };

  useEffect(() => {
    if (!visible) {
      setPoints([]);
      return;
    }
    let cancelled = false;
    void listForReview(pointIds).then((rows) => {
      if (!cancelled) setPoints(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, pointIds]);

  // An answered card leaves the list, so a point is never answered twice in one visit.
  const answer = async (point: Point, result: 'remembered' | 'again_soon') => {
    setPoints((current) => current.filter((p) => p.id !== point.id));
    await onAnswer(point, result);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        <Text style={[styles.heading, { color: colors.text }]}>{t.reviewTitle}</Text>
        {voiceEnabled && points.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={speaking ? t.stopListening : t.listen}
            onPress={() => void toggleListen()}
            style={[styles.listen, { borderColor: colors.accent }]}
          >
            <Text style={{ color: colors.accent, fontWeight: '600' }}>{speaking ? t.stopListening : t.listen}</Text>
          </Pressable>
        ) : null}
        {missing.map((language) => (
          <Text key={language} style={[styles.empty, { color: colors.mutedText, marginTop: 0, marginBottom: 8 }]}>
            {t.voiceMissing.replace('{language}', language)}
          </Text>
        ))}
        <FlatList
          data={points}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.mutedText }]}>{t.reviewEmpty}</Text>}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: colors.mutedText }]}>
              <Text style={[styles.cardText, { color: colors.text }]}>{item.prompt}</Text>
              <View style={styles.answers}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.remembered}
                  onPress={() => void answer(item, 'remembered')}
                  style={[styles.answer, { backgroundColor: colors.accent }]}
                >
                  <Text style={{ color: colors.onAccent, fontWeight: '600' }}>{t.remembered}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.againSoon}
                  onPress={() => void answer(item, 'again_soon')}
                  style={[styles.answer, { borderColor: colors.accent, borderWidth: 1 }]}
                >
                  <Text style={{ color: colors.accent, fontWeight: '600' }}>{t.againSoon}</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.reviewDone}
          onPress={onClose}
          style={[styles.done, { backgroundColor: colors.accent, marginBottom: insets.bottom + 16 }]}
        >
          <Text style={{ color: colors.onAccent, fontWeight: '600', fontSize: 16 }}>{t.reviewDone}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  heading: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 16, paddingHorizontal: 24 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16 },
  cardText: { fontSize: 22, lineHeight: 32 },
  listen: { alignSelf: 'flex-start', minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 18, justifyContent: 'center', marginBottom: 12 },
  answers: { flexDirection: 'row', gap: 10, marginTop: 14 },
  answer: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  done: { alignItems: 'center', paddingVertical: 14, borderRadius: 12 },
});
