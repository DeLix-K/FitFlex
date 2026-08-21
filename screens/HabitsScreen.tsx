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
import { checkInToday, createHabit, deleteHabit, fetchHabits, uncheckToday } from '../lib/habits';
import { dark } from '../lib/theme';
import type { HabitWithStatus } from '../lib/types';

export default function HabitsScreen() {
  const [habits, setHabits] = useState<HabitWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchHabits();
      setHabits(data);
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

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createHabit(newName);
      setNewName('');
      setAdding(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (habit: HabitWithStatus) => {
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

  const completionPct = useMemo(() => {
    if (habits.length === 0) return 0;
    const done = habits.filter((h) => h.done_today).length;
    return Math.round((done / habits.length) * 100);
  }, [habits]);

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
          <Text style={styles.title}>Habits</Text>
          <Text style={styles.subtitle}>Build daily habits and watch your streaks grow.</Text>
          {error && <Text style={styles.error}>{error}</Text>}

          {adding ? (
            <View style={styles.newRow}>
              <TextInput
                style={styles.newInput}
                placeholder="New habit (e.g. Drink water)"
                placeholderTextColor={dark.textFaint}
                value={newName}
                onChangeText={setNewName}
                onSubmitEditing={handleCreate}
                autoFocus
              />
              <Pressable style={styles.addButton} onPress={handleCreate} disabled={creating}>
                {creating ? (
                  <ActivityIndicator size="small" color="#0a0a0a" />
                ) : (
                  <Text style={styles.addButtonText}>Add</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.createButton} onPress={() => setAdding(true)}>
              <Text style={styles.createButtonText}>+ Create New Habit</Text>
            </Pressable>
          )}
        </>
      }
      data={habits}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <Text style={styles.empty}>No habits yet — add one above to get started.</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Pressable
            style={[styles.checkbox, item.done_today && styles.checkboxDone]}
            onPress={() => handleToggle(item)}
            disabled={busyId === item.id}
          >
            {busyId === item.id ? (
              <ActivityIndicator size="small" color={item.done_today ? '#0a0a0a' : dark.accent} />
            ) : (
              item.done_today && <Text style={styles.checkboxMark}>✓</Text>
            )}
          </Pressable>

          <View style={styles.rowMiddle}>
            <Text style={styles.habitName}>{item.name}</Text>
            <Text style={styles.habitStreak}>
              {item.current_streak > 0 ? `🔥 ${item.current_streak} day streak` : 'No streak yet'}
            </Text>
          </View>

          <Text style={[styles.statusTag, item.done_today ? styles.statusDone : styles.statusPending]}>
            {item.done_today ? 'Complete' : 'Pending'}
          </Text>

          <Pressable onPress={() => handleDelete(item.id)} disabled={busyId === item.id}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      )}
      ListFooterComponent={
        habits.length > 0 ? (
          <View style={styles.completionBar}>
            <Text style={styles.completionLabel}>Today's Completion: {completionPct}%</Text>
            <View style={styles.completionTrack}>
              <View style={[styles.completionFill, { width: `${completionPct}%` }]} />
            </View>
          </View>
        ) : null
      }
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
  },
  error: {
    color: dark.danger,
    marginBottom: 12,
  },
  newRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  newInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    color: dark.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 64,
  },
  addButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
  createButton: {
    borderWidth: 1,
    borderColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  createButtonText: {
    color: dark.accent,
    fontWeight: '700',
  },
  empty: {
    color: dark.textFaint,
    textAlign: 'center',
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: dark.accent,
  },
  checkboxMark: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
  rowMiddle: {
    flex: 1,
  },
  habitName: {
    fontSize: 15,
    fontWeight: '700',
    color: dark.text,
  },
  habitStreak: {
    fontSize: 12,
    color: dark.textMuted,
    marginTop: 2,
  },
  statusTag: {
    fontSize: 10,
    fontWeight: '700',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  statusDone: {
    color: '#0a0a0a',
    backgroundColor: dark.accent,
  },
  statusPending: {
    color: dark.textMuted,
    backgroundColor: dark.surfaceElevated,
  },
  remove: {
    color: dark.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  completionBar: {
    marginTop: 8,
  },
  completionLabel: {
    color: dark.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  completionTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: dark.surfaceElevated,
    overflow: 'hidden',
  },
  completionFill: {
    height: 10,
    borderRadius: 5,
    backgroundColor: dark.accent,
  },
});
