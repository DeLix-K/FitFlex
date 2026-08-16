import { useCallback, useEffect, useState } from 'react';
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
import { colors } from '../lib/theme';
import type { HabitWithStatus } from '../lib/types';

export default function HabitsScreen() {
  const [habits, setHabits] = useState<HabitWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Habits</Text>
          <Text style={styles.subtitle}>Build daily habits and watch your streaks grow.</Text>
          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.newRow}>
            <TextInput
              style={styles.newInput}
              placeholder="New habit (e.g. Drink water)"
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={handleCreate}
            />
            <Pressable style={styles.addButton} onPress={handleCreate} disabled={creating}>
              {creating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.addButtonText}>Add</Text>
              )}
            </Pressable>
          </View>
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
              <ActivityIndicator size="small" color={item.done_today ? '#fff' : colors.primary} />
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

          <Pressable onPress={() => handleDelete(item.id)} disabled={busyId === item.id}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textFaint,
    marginTop: 4,
    marginBottom: 16,
  },
  error: {
    color: colors.danger,
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
    borderColor: colors.borderInput,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 64,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  empty: {
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: colors.primary,
  },
  checkboxMark: {
    color: '#fff',
    fontWeight: '700',
  },
  rowMiddle: {
    flex: 1,
  },
  habitName: {
    fontSize: 15,
    fontWeight: '700',
  },
  habitStreak: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  remove: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
});
