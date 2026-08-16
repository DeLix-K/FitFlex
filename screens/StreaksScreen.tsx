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
import {
  fetchLeaderboard,
  getMyStats,
  hasLoggedToday,
  logWorkoutToday,
  updateDisplayName,
} from '../lib/streaks';
import { colors } from '../lib/theme';
import { supabase } from '../lib/supabase';
import type { LeaderboardEntry } from '../lib/types';

export default function StreaksScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [displayName, setDisplayName] = useState('Fitness Fan');
  const [nameInput, setNameInput] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [loggedToday, setLoggedToday] = useState(false);
  const [logging, setLogging] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);

      const [stats, logged, board] = await Promise.all([
        getMyStats(),
        hasLoggedToday(),
        fetchLeaderboard(),
      ]);
      setCurrentStreak(stats.currentStreak);
      setTotalWorkouts(stats.totalWorkouts);
      setDisplayName(stats.displayName);
      setNameInput(stats.displayName === 'Fitness Fan' ? '' : stats.displayName);
      setLoggedToday(logged);
      setLeaderboard(board);
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

  const handleLog = async () => {
    setLogging(true);
    setError(null);
    try {
      await logWorkoutToday();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLogging(false);
    }
  };

  const handleSaveName = async () => {
    try {
      await updateDisplayName(nameInput);
      setEditingName(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
          <Text style={styles.title}>Streak</Text>

          <View style={styles.streakCard}>
            <Text style={styles.streakNumber}>{currentStreak > 0 ? '🔥' : ''} {currentStreak}</Text>
            <Text style={styles.streakLabel}>
              {currentStreak === 1 ? 'day streak' : 'day streak'}
            </Text>
            <Text style={styles.totalWorkouts}>{totalWorkouts} total workouts logged</Text>

            <Pressable
              style={[styles.logButton, loggedToday && styles.logButtonDone]}
              onPress={handleLog}
              disabled={loggedToday || logging}
            >
              {logging ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.logButtonText}>
                  {loggedToday ? "✓ Logged today's workout" : "Log today's workout"}
                </Text>
              )}
            </Pressable>
          </View>

          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                placeholder="Your display name"
                value={nameInput}
                onChangeText={setNameInput}
                maxLength={30}
              />
              <Pressable onPress={handleSaveName}>
                <Text style={styles.nameSave}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditingName(true)} style={styles.nameRow}>
              <Text style={styles.nameLabel}>
                Leaderboard name: <Text style={styles.nameValue}>{displayName}</Text>
              </Text>
              <Text style={styles.nameEdit}>Edit</Text>
            </Pressable>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.sectionTitle}>Leaderboard</Text>
        </>
      }
      data={leaderboard}
      keyExtractor={(item) => item.user_id}
      ListEmptyComponent={<Text style={styles.empty}>No streaks yet — be the first!</Text>}
      renderItem={({ item, index }) => (
        <View style={[styles.row, item.user_id === userId && styles.rowMe]}>
          <Text style={styles.rank}>{index + 1}</Text>
          <Text style={styles.rowName}>
            {item.display_name}
            {item.user_id === userId ? ' (you)' : ''}
          </Text>
          <View style={styles.rowStats}>
            <Text style={styles.rowStreak}>🔥 {item.current_streak}</Text>
            <Text style={styles.rowTotal}>{item.total_workouts} total</Text>
          </View>
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
    marginBottom: 12,
  },
  streakCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  streakNumber: {
    fontSize: 40,
    fontWeight: '800',
  },
  streakLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  totalWorkouts: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
    marginBottom: 16,
  },
  logButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minWidth: 220,
    alignItems: 'center',
  },
  logButtonDone: {
    backgroundColor: colors.success,
  },
  logButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  nameLabel: {
    fontSize: 13,
    color: '#666',
  },
  nameValue: {
    fontWeight: '700',
    color: '#222',
  },
  nameEdit: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  nameSave: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  empty: {
    color: '#888',
    textAlign: 'center',
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  rowMe: {
    borderColor: colors.primary,
    backgroundColor: '#eff6ff',
  },
  rank: {
    width: 24,
    fontSize: 13,
    color: '#999',
    fontWeight: '700',
  },
  rowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  rowStats: {
    alignItems: 'flex-end',
  },
  rowStreak: {
    fontSize: 13,
    fontWeight: '700',
  },
  rowTotal: {
    fontSize: 11,
    color: '#999',
  },
});
