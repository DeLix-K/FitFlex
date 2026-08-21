import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AiUsageIndicator from '../components/AiUsageIndicator';
import { useAiGate } from '../hooks/useAiGate';
import { getOuraData } from '../lib/oura';
import { dark } from '../lib/theme';
import type { MoodLog } from '../lib/types';
import {
  fetchHydrationToday,
  fetchMoodHistory,
  logMood,
  reflectOnMood,
  setHydrationToday,
  todayLocalDate,
} from '../lib/wellness';

const MOODS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😫', label: 'Very low' },
  { value: 2, emoji: '😕', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

const SCALE_LABELS = ['1', '2', '3', '4', '5'];
const HYDRATION_GOAL = 8;
const BREATH_PHASES = ['Breathe in...', 'Hold...', 'Breathe out...', 'Hold...'];
const BREATH_PHASE_SECONDS = 4;

function moodEmoji(mood: number): string {
  return MOODS.find((m) => m.value === mood)?.emoji ?? '😐';
}

function ScaleRow({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.scaleRow}>
      {SCALE_LABELS.map((label, i) => {
        const v = i + 1;
        return (
          <Pressable
            key={v}
            style={[styles.scaleDot, value === v && styles.scaleDotSelected]}
            onPress={() => onChange(v)}
          >
            <Text style={[styles.scaleDotText, value === v && styles.scaleDotTextSelected]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function WellnessScreen() {
  const [history, setHistory] = useState<MoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mood, setMood] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [reflecting, setReflecting] = useState(false);
  const [recoveryScore, setRecoveryScore] = useState<number | null>(null);
  const [glasses, setGlasses] = useState(0);
  const [breathPhaseIndex, setBreathPhaseIndex] = useState<number | null>(null);
  const [breathSecondsLeft, setBreathSecondsLeft] = useState(BREATH_PHASE_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const aiGate = useAiGate();
  const breathTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const today = todayLocalDate();
  const todayEntry = history.find((h) => h.log_date === today) ?? null;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [data, hydration, oura] = await Promise.all([
        fetchMoodHistory(),
        fetchHydrationToday(todayLocalDate()),
        getOuraData().catch(() => ({ connected: false }) as const),
      ]);
      setHistory(data);
      setGlasses(hydration);
      setRecoveryScore('connected' in oura && oura.connected ? oura.recoveryScore : null);
      const existing = data.find((h) => h.log_date === todayLocalDate());
      if (existing) {
        setMood(existing.mood);
        setStress(existing.stress);
        setEnergy(existing.energy);
        setNotes(existing.notes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    return () => {
      if (breathTimer.current) clearInterval(breathTimer.current);
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleSave = async () => {
    if (mood == null) {
      setError('Pick how you\'re feeling first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await logMood({ logDate: today, mood, notes, stress, energy });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReflect = async () => {
    if (!todayEntry) return;
    if (!aiGate.canUse) {
      setError("You've used today's free AI actions. Upgrade to Premium for unlimited access.");
      return;
    }
    setReflecting(true);
    setError(null);
    try {
      await reflectOnMood(todayEntry.id, todayEntry.mood, todayEntry.notes);
      aiGate.refresh();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReflecting(false);
    }
  };

  const adjustGlasses = async (delta: number) => {
    const next = Math.max(0, glasses + delta);
    setGlasses(next);
    try {
      await setHydrationToday(today, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const startBreathing = () => {
    if (breathTimer.current) clearInterval(breathTimer.current);
    setBreathPhaseIndex(0);
    setBreathSecondsLeft(BREATH_PHASE_SECONDS);
    let phase = 0;
    let seconds = BREATH_PHASE_SECONDS;
    breathTimer.current = setInterval(() => {
      seconds -= 1;
      if (seconds <= 0) {
        phase = (phase + 1) % BREATH_PHASES.length;
        seconds = BREATH_PHASE_SECONDS;
      }
      setBreathPhaseIndex(phase);
      setBreathSecondsLeft(seconds);
    }, 1000);
  };

  const stopBreathing = () => {
    if (breathTimer.current) clearInterval(breathTimer.current);
    breathTimer.current = null;
    setBreathPhaseIndex(null);
  };

  const wellnessScore = useMemo(() => {
    const components: number[] = [];
    if (mood != null) components.push((mood - 1) * 25);
    if (energy != null) components.push((energy - 1) * 25);
    if (stress != null) components.push((5 - stress) * 25);
    if (recoveryScore != null) components.push(recoveryScore);
    if (components.length === 0) return null;
    return Math.round(components.reduce((a, b) => a + b, 0) / components.length);
  }, [mood, energy, stress, recoveryScore]);

  const scoreLabel = (score: number | null) => {
    if (score == null) return 'Check in below to see your score';
    if (score >= 80) return "You're doing great";
    if (score >= 60) return "You're doing well";
    if (score >= 40) return 'Take it easy today';
    return 'Be gentle with yourself today';
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={dark.accent} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={dark.accent} />}
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Wellness</Text>
          <Text style={styles.subtitle}>
            Check in with how you're feeling. This isn't a substitute for professional support —
            if you're struggling, please reach out to someone who can help.
          </Text>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreValue}>{wellnessScore != null ? `${wellnessScore}/100` : '—'}</Text>
            <Text style={styles.scoreLabel}>{scoreLabel(wellnessScore)}</Text>
          </View>

          <View style={styles.sectionsGrid}>
            <View style={styles.sectionBox}>
              <Text style={styles.sectionIcon}>😊</Text>
              <Text style={styles.sectionLabel}>Mood</Text>
              <Text style={styles.sectionValue}>{mood != null ? moodEmoji(mood) : '—'}</Text>
            </View>
            <View style={styles.sectionBox}>
              <Text style={styles.sectionIcon}>😰</Text>
              <Text style={styles.sectionLabel}>Stress</Text>
              <Text style={styles.sectionValue}>{stress != null ? `${stress}/5` : '—'}</Text>
            </View>
            <View style={styles.sectionBox}>
              <Text style={styles.sectionIcon}>⚡</Text>
              <Text style={styles.sectionLabel}>Energy</Text>
              <Text style={styles.sectionValue}>{energy != null ? `${energy}/5` : '—'}</Text>
            </View>
            <View style={styles.sectionBox}>
              <Text style={styles.sectionIcon}>💚</Text>
              <Text style={styles.sectionLabel}>Recovery</Text>
              <Text style={styles.sectionValue}>{recoveryScore != null ? recoveryScore : 'Connect Oura'}</Text>
            </View>
          </View>

          <AiUsageIndicator
            isPremium={aiGate.isPremium}
            remaining={aiGate.remaining}
            loaded={aiGate.loaded}
          />
          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.form}>
            <Text style={styles.formLabel}>How are you feeling today?</Text>
            <View style={styles.moodRow}>
              {MOODS.map((m) => (
                <Pressable
                  key={m.value}
                  style={[styles.moodButton, mood === m.value && styles.moodButtonSelected]}
                  onPress={() => setMood(m.value)}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text
                    style={[styles.moodLabel, mood === m.value && styles.moodLabelSelected]}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.formLabel}>Stress level</Text>
            <ScaleRow value={stress} onChange={setStress} />

            <Text style={styles.formLabel}>Energy level</Text>
            <ScaleRow value={energy} onChange={setEnergy} />

            <TextInput
              style={styles.notesInput}
              placeholder="What's on your mind? (optional)"
              placeholderTextColor={dark.textFaint}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#0a0a0a" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {todayEntry ? 'Update Today\'s Check-in' : 'Save Check-in'}
                </Text>
              )}
            </Pressable>

            {todayEntry && !todayEntry.ai_reflection && (
              <Pressable
                style={styles.reflectButton}
                onPress={handleReflect}
                disabled={reflecting}
              >
                {reflecting ? (
                  <ActivityIndicator color={dark.accent} size="small" />
                ) : (
                  <Text style={styles.reflectButtonText}>Reflect with AI</Text>
                )}
              </Pressable>
            )}

            {todayEntry?.ai_reflection && (
              <View style={styles.reflectionCard}>
                <Text style={styles.reflectionLabel}>AI Reflection</Text>
                <Text style={styles.reflectionText}>{todayEntry.ai_reflection}</Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>💧 Hydration</Text>
          <View style={styles.hydrationCard}>
            <Text style={styles.hydrationValue}>{glasses} / {HYDRATION_GOAL} glasses</Text>
            <View style={styles.hydrationTrack}>
              <View
                style={[
                  styles.hydrationFill,
                  { width: `${Math.min(100, (glasses / HYDRATION_GOAL) * 100)}%` },
                ]}
              />
            </View>
            <View style={styles.hydrationButtons}>
              <Pressable style={styles.hydrationButton} onPress={() => adjustGlasses(-1)}>
                <Text style={styles.hydrationButtonText}>−</Text>
              </Pressable>
              <Pressable style={styles.hydrationButton} onPress={() => adjustGlasses(1)}>
                <Text style={styles.hydrationButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.sectionTitle}>🧘 Mindfulness & Breathing</Text>
          <View style={styles.breathCard}>
            {breathPhaseIndex != null ? (
              <>
                <Text style={styles.breathPhase}>{BREATH_PHASES[breathPhaseIndex]}</Text>
                <Text style={styles.breathCountdown}>{breathSecondsLeft}</Text>
                <Pressable style={styles.breathStopButton} onPress={stopBreathing}>
                  <Text style={styles.breathStopButtonText}>Stop</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.breathStartButton} onPress={startBreathing}>
                <Text style={styles.breathStartButtonText}>Start Breathing Exercise</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.sectionTitle}>Recent Check-ins</Text>
        </>
      }
      data={history.filter((h) => h.log_date !== today)}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<Text style={styles.empty}>No past check-ins yet.</Text>}
      renderItem={({ item }) => (
        <View style={styles.historyRow}>
          <Text style={styles.historyEmoji}>{moodEmoji(item.mood)}</Text>
          <View style={styles.historyMiddle}>
            <Text style={styles.historyDate}>{item.log_date}</Text>
            {item.notes ? <Text style={styles.historyNotes}>{item.notes}</Text> : null}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    backgroundColor: dark.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: dark.text,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: dark.textFaint,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  scoreCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 20,
    paddingVertical: 20,
    marginBottom: 12,
  },
  scoreValue: {
    color: dark.text,
    fontSize: 32,
    fontWeight: '800',
  },
  scoreLabel: {
    color: dark.accent,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  sectionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  sectionBox: {
    width: '48%',
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 14,
    padding: 14,
  },
  sectionIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  sectionLabel: {
    color: dark.textFaint,
    fontSize: 11,
    fontWeight: '700',
  },
  sectionValue: {
    color: dark.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  error: {
    color: dark.danger,
    marginBottom: 12,
  },
  form: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: dark.text,
    marginBottom: 10,
    marginTop: 6,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  moodButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    flex: 1,
  },
  moodButtonSelected: {
    backgroundColor: dark.surfaceElevated,
    borderColor: dark.accent,
  },
  moodEmoji: {
    fontSize: 24,
  },
  moodLabel: {
    fontSize: 10,
    color: dark.textFaint,
    marginTop: 4,
    textAlign: 'center',
  },
  moodLabelSelected: {
    color: dark.accent,
    fontWeight: '600',
  },
  scaleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  scaleDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleDotSelected: {
    backgroundColor: dark.accent,
    borderColor: dark.accent,
  },
  scaleDotText: {
    fontSize: 13,
    fontWeight: '600',
    color: dark.text,
  },
  scaleDotTextSelected: {
    color: '#0a0a0a',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surfaceElevated,
    color: dark.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    marginTop: 6,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
  reflectButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reflectButtonText: {
    color: dark.accent,
    fontWeight: '700',
  },
  reflectionCard: {
    marginTop: 12,
    backgroundColor: dark.surfaceElevated,
    borderRadius: 8,
    padding: 12,
  },
  reflectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: dark.textMuted,
    marginBottom: 4,
  },
  reflectionText: {
    fontSize: 13,
    color: dark.text,
    lineHeight: 19,
  },
  sectionTitle: {
    color: dark.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  hydrationCard: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  hydrationValue: {
    color: dark.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  hydrationTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: dark.surfaceElevated,
    overflow: 'hidden',
    marginBottom: 12,
  },
  hydrationFill: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#38bdf8',
  },
  hydrationButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  hydrationButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  hydrationButtonText: {
    color: dark.text,
    fontSize: 18,
    fontWeight: '700',
  },
  breathCard: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  breathPhase: {
    color: dark.text,
    fontSize: 16,
    fontWeight: '700',
  },
  breathCountdown: {
    color: dark.accent,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 12,
  },
  breathStopButton: {
    borderWidth: 1,
    borderColor: dark.danger,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  breathStopButtonText: {
    color: dark.danger,
    fontWeight: '700',
  },
  breathStartButton: {
    backgroundColor: dark.accent,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  breathStartButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
  empty: {
    color: dark.textFaint,
    textAlign: 'center',
    marginTop: 12,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  historyEmoji: {
    fontSize: 22,
  },
  historyMiddle: {
    flex: 1,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: '700',
    color: dark.text,
  },
  historyNotes: {
    fontSize: 12,
    color: dark.textMuted,
    marginTop: 2,
  },
});
