import { useCallback, useEffect, useMemo, useState } from 'react';
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
import BinauralBeatsLibrary from '../components/BinauralBeatsLibrary';
import BreathworkSphere from '../components/BreathworkSphere';
import HabitStackSuggestion from '../components/HabitStackSuggestion';
import SleepPerformanceInsight from '../components/SleepPerformanceInsight';
import StressInterrupter from '../components/StressInterrupter';
import WellnessRecommendationCard from '../components/WellnessRecommendationCard';
import WellnessReadinessGauge from '../components/WellnessReadinessGauge';
import WellnessTipCarousel from '../components/WellnessTipCarousel';
import { useAiGate } from '../hooks/useAiGate';
import { getOuraData } from '../lib/oura';
import { fetchSleepHistory } from '../lib/sleep';
import { hasLoggedToday } from '../lib/streaks';
import { calm } from '../lib/theme';
import type { MoodLog } from '../lib/types';
import {
  fetchHydrationToday,
  fetchMoodHistory,
  getTodayPrompt,
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

function moodEmoji(mood: number): string {
  return MOODS.find((m) => m.value === mood)?.emoji ?? '😐';
}

function ScaleRow({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
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
  const [sleepHours, setSleepHours] = useState<number | null>(null);
  const [workoutLoggedToday, setWorkoutLoggedToday] = useState(false);
  const [glasses, setGlasses] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const aiGate = useAiGate();

  const today = todayLocalDate();
  const todayEntry = history.find((h) => h.log_date === today) ?? null;
  const todayPrompt = useMemo(getTodayPrompt, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [data, hydration, oura, latestSleep, workoutToday] = await Promise.all([
        fetchMoodHistory(),
        fetchHydrationToday(todayLocalDate()),
        getOuraData().catch(() => ({ connected: false }) as const),
        fetchSleepHistory(1).catch(() => []),
        hasLoggedToday().catch(() => false),
      ]);
      setHistory(data);
      setGlasses(hydration);
      setRecoveryScore('connected' in oura && oura.connected ? oura.recoveryScore : null);
      setSleepHours(latestSleep[0]?.duration_minutes != null ? latestSleep[0].duration_minutes / 60 : null);
      setWorkoutLoggedToday(workoutToday);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleSave = async () => {
    if (mood == null) {
      setError("Pick how you're feeling first.");
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

  const wellnessScore = useMemo(() => {
    const components: number[] = [];
    if (mood != null) components.push((mood - 1) * 25);
    if (energy != null) components.push((energy - 1) * 25);
    if (stress != null) components.push((5 - stress) * 25);
    if (recoveryScore != null) components.push(recoveryScore);
    if (components.length === 0) return null;
    return Math.round(components.reduce((a, b) => a + b, 0) / components.length);
  }, [mood, energy, stress, recoveryScore]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={calm.accent} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={calm.accent} />}
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Wellness</Text>
          <Text style={styles.subtitle}>
            This isn't a substitute for professional support — if you're struggling, please reach
            out to someone who can help.
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}

          <WellnessReadinessGauge score={wellnessScore} />

          <WellnessRecommendationCard
            isPremium={!!aiGate.isPremium}
            wellnessScore={wellnessScore}
            mood={mood}
            stress={stress}
            energy={energy}
            recoveryScore={recoveryScore}
            sleepHours={sleepHours}
          />

          <StressInterrupter />

          <HabitStackSuggestion
            visible={workoutLoggedToday && glasses < 2}
            glasses={glasses}
            onAddGlass={() => adjustGlasses(1)}
          />

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

          <AiUsageIndicator isPremium={aiGate.isPremium} remaining={aiGate.remaining} loaded={aiGate.loaded} />

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
                  <Text style={[styles.moodLabel, mood === m.value && styles.moodLabelSelected]}>{m.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.formLabel}>Stress level</Text>
            <ScaleRow value={stress} onChange={setStress} />

            <Text style={styles.formLabel}>Energy level</Text>
            <ScaleRow value={energy} onChange={setEnergy} />

            <Text style={styles.formLabel}>💭 {todayPrompt}</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="30 seconds is enough (optional)"
              placeholderTextColor={calm.textFaint}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#0a2420" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>{todayEntry ? "Update Today's Check-in" : 'Save Check-in'}</Text>
              )}
            </Pressable>

            {todayEntry && !todayEntry.ai_reflection && (
              <Pressable style={styles.reflectButton} onPress={handleReflect} disabled={reflecting}>
                {reflecting ? (
                  <ActivityIndicator color={calm.accent} size="small" />
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
            <Text style={styles.hydrationValue}>
              {glasses} / {HYDRATION_GOAL} glasses
            </Text>
            <View style={styles.hydrationTrack}>
              <View style={[styles.hydrationFill, { width: `${Math.min(100, (glasses / HYDRATION_GOAL) * 100)}%` }]} />
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

          <BreathworkSphere isPremium={!!aiGate.isPremium} />

          <BinauralBeatsLibrary isPremium={!!aiGate.isPremium} />

          <SleepPerformanceInsight isPremium={!!aiGate.isPremium} />

          <WellnessTipCarousel />

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
    backgroundColor: calm.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    backgroundColor: calm.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: calm.text,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: calm.textFaint,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  error: {
    color: calm.danger,
    marginBottom: 12,
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
    borderColor: calm.border,
    backgroundColor: calm.surface,
    borderRadius: 16,
    padding: 14,
  },
  sectionIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  sectionLabel: {
    color: calm.textFaint,
    fontSize: 11,
    fontWeight: '700',
  },
  sectionValue: {
    color: calm.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  form: {
    borderWidth: 1,
    borderColor: calm.border,
    backgroundColor: calm.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: calm.text,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    flex: 1,
  },
  moodButtonSelected: {
    backgroundColor: calm.surfaceElevated,
    borderColor: calm.accent,
  },
  moodEmoji: {
    fontSize: 24,
  },
  moodLabel: {
    fontSize: 10,
    color: calm.textFaint,
    marginTop: 4,
    textAlign: 'center',
  },
  moodLabelSelected: {
    color: calm.accent,
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
    borderColor: calm.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleDotSelected: {
    backgroundColor: calm.accent,
    borderColor: calm.accent,
  },
  scaleDotText: {
    fontSize: 13,
    fontWeight: '600',
    color: calm.text,
  },
  scaleDotTextSelected: {
    color: '#0a2420',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: calm.border,
    backgroundColor: calm.surfaceElevated,
    color: calm.text,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    marginTop: 6,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: calm.accent,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#0a2420',
    fontWeight: '700',
  },
  reflectButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: calm.accent,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reflectButtonText: {
    color: calm.accent,
    fontWeight: '700',
  },
  reflectionCard: {
    marginTop: 12,
    backgroundColor: calm.surfaceElevated,
    borderRadius: 12,
    padding: 12,
  },
  reflectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: calm.textMuted,
    marginBottom: 4,
  },
  reflectionText: {
    fontSize: 13,
    color: calm.text,
    lineHeight: 19,
  },
  sectionTitle: {
    color: calm.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  hydrationCard: {
    borderWidth: 1,
    borderColor: calm.border,
    backgroundColor: calm.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  hydrationValue: {
    color: calm.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  hydrationTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: calm.surfaceElevated,
    overflow: 'hidden',
    marginBottom: 12,
  },
  hydrationFill: {
    height: 10,
    borderRadius: 5,
    backgroundColor: calm.accent,
  },
  hydrationButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  hydrationButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: calm.border,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  hydrationButtonText: {
    color: calm.text,
    fontSize: 18,
    fontWeight: '700',
  },
  empty: {
    color: calm.textFaint,
    textAlign: 'center',
    marginTop: 12,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: calm.border,
    backgroundColor: calm.surface,
    borderRadius: 14,
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
    color: calm.text,
  },
  historyNotes: {
    fontSize: 12,
    color: calm.textMuted,
    marginTop: 2,
  },
});
