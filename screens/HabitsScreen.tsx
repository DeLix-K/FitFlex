import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import CreateHabitModal from '../components/CreateHabitModal';
import HabitFreezeFooter from '../components/HabitFreezeFooter';
import HabitInsightCard from '../components/HabitInsightCard';
import HabitMomentumRing from '../components/HabitMomentumRing';
import HabitTimeSection from '../components/HabitTimeSection';
import {
  autoSyncHabits,
  checkInToday,
  computeHabitCorrelations,
  deleteHabit,
  fetchHabitLogHistory,
  fetchHabitMomentum,
  fetchHabits,
  fetchWorkoutLogHistory,
  grantHabitFreezeIfEarned,
  logProgressToday,
  uncheckToday,
  useHabitFreeze,
} from '../lib/habits';
import { fetchSleepHistory } from '../lib/sleep';
import { fetchStreakFreezeBalance } from '../lib/streaks';
import { dark } from '../lib/theme';
import type { HabitWithStatus } from '../lib/types';

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentTimeBucket(): 'morning' | 'midday' | 'evening' {
  const h = new Date().getHours();
  if (h >= 4 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'midday';
  return 'evening';
}

export default function HabitsScreen() {
  const [habits, setHabits] = useState<HabitWithStatus[]>([]);
  const [momentum, setMomentum] = useState(0);
  const [freezeBalance, setFreezeBalance] = useState(0);
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [freezeUsedToday, setFreezeUsedToday] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeBucket = useMemo(currentTimeBucket, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      let data = await fetchHabits();
      const didAutoSync = await autoSyncHabits(data).catch(() => false);
      if (didAutoSync) data = await fetchHabits();
      setHabits(data);

      const [freezeGrant, freezeRow, momentumStreak] = await Promise.all([
        grantHabitFreezeIfEarned().catch(() => null),
        fetchStreakFreezeBalance().catch(() => null),
        fetchHabitMomentum().catch(() => 0),
      ]);
      setFreezeBalance(freezeGrant ?? freezeRow?.balance ?? 0);
      setMomentum(momentumStreak);

      const [habitHistory, workoutHistory, sleepHistory] = await Promise.all([
        fetchHabitLogHistory().catch(() => []),
        fetchWorkoutLogHistory().catch(() => []),
        fetchSleepHistory(60).catch(() => []),
      ]);
      setInsight(computeHabitCorrelations(data, habitHistory, workoutHistory, sleepHistory));
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

  const handleToggleBoolean = async (habit: HabitWithStatus) => {
    setBusyId(habit.id);
    setError(null);
    try {
      if (habit.done_today) await uncheckToday(habit.id);
      else await checkInToday(habit.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveProgress = async (habit: HabitWithStatus, value: number) => {
    try {
      await logProgressToday(habit.id, value);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (habitId: string) => {
    setBusyId(habitId);
    setError(null);
    try {
      await deleteHabit(habitId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleUseFreeze = async () => {
    const ok = await useHabitFreeze(todayLocalDate());
    if (ok) {
      setFreezeUsedToday(true);
      await load();
    } else {
      throw new Error('Could not use a freeze — check your balance.');
    }
  };

  const completionPct = useMemo(() => {
    if (habits.length === 0) return 0;
    const done = habits.filter((h) => h.done_today).length;
    return Math.round((done / habits.length) * 100);
  }, [habits]);

  const momentumMessage = useMemo(() => {
    if (habits.length === 0) return 'Add your first habit to start building momentum.';
    const remaining = habits.filter((h) => !h.done_today).length;
    if (remaining === 0) return 'All habits complete today! 🎉';
    return `${remaining} more habit${remaining === 1 ? '' : 's'} to go today.`;
  }, [habits]);

  const grouped = useMemo(() => {
    const buckets: Record<'morning' | 'midday' | 'evening', HabitWithStatus[]> = {
      morning: [],
      midday: [],
      evening: [],
    };
    for (const habit of habits) {
      const bucket = habit.time_of_day === 'anytime' ? activeBucket : habit.time_of_day;
      buckets[bucket].push(habit);
    }
    return buckets;
  }, [habits, activeBucket]);

  const sectionOrder = useMemo(() => {
    const order: ('morning' | 'midday' | 'evening')[] = ['morning', 'midday', 'evening'];
    return [activeBucket, ...order.filter((s) => s !== activeBucket)];
  }, [activeBucket]);

  const momentumSecuredToday = habits.some((h) => h.done_today) || freezeUsedToday;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={dark.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={dark.accent} />}
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>Habit Hub</Text>
        <Pressable style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Text style={styles.addButtonText}>+ New Habit</Text>
        </Pressable>
      </View>
      <Text style={styles.subtitle}>Consistency over perfection — momentum forgives a missed day.</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <HabitMomentumRing
        completionPct={completionPct}
        message={momentumMessage}
        momentumStreak={momentum}
        freezeBalance={freezeBalance}
      />

      {habits.length === 0 ? (
        <Text style={styles.empty}>No habits yet — tap "+ New Habit" to get started.</Text>
      ) : (
        sectionOrder.map((section) => (
          <HabitTimeSection
            key={section}
            timeOfDay={section}
            habits={grouped[section]}
            isActive={section === activeBucket}
            busyId={busyId}
            onToggleBoolean={handleToggleBoolean}
            onSaveProgress={handleSaveProgress}
            onDelete={handleDelete}
          />
        ))
      )}

      <HabitInsightCard insight={insight} />

      <HabitFreezeFooter
        freezeBalance={freezeBalance}
        alreadyCoveredToday={momentumSecuredToday}
        onUseFreeze={handleUseFreeze}
      />

      <CreateHabitModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreated={() => {
          setModalVisible(false);
          load();
        }}
      />
    </ScrollView>
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: dark.text,
    fontSize: 22,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: dark.accent,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  addButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 12,
  },
  subtitle: {
    fontSize: 13,
    color: dark.textFaint,
    marginTop: 4,
    marginBottom: 14,
  },
  error: {
    color: dark.danger,
    marginBottom: 12,
  },
  empty: {
    color: dark.textFaint,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
});
