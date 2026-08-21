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
import Svg, { Circle } from 'react-native-svg';
import {
  fetchLeaderboard,
  fetchLoggedDates,
  getMyStats,
  hasLoggedToday,
  logWorkoutToday,
  updateDisplayName,
} from '../lib/streaks';
import { dark } from '../lib/theme';
import { supabase } from '../lib/supabase';
import type { LeaderboardEntry } from '../lib/types';

const RING_SIZE = 88;
const RING_STROKE = 8;

function ProgressRing({ progress }: { progress: number }) {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <Svg width={RING_SIZE} height={RING_SIZE}>
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={radius}
        stroke={dark.border}
        strokeWidth={RING_STROKE}
        fill="none"
      />
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={radius}
        stroke={dark.accent}
        strokeWidth={RING_STROKE}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        rotation={-90}
        origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
      />
    </Svg>
  );
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function StreaksScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [displayName, setDisplayName] = useState('Fitness Fan');
  const [nameInput, setNameInput] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [loggedToday, setLoggedToday] = useState(false);
  const [logging, setLogging] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [monthLoggedDates, setMonthLoggedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);

      const monthStart = toDateStr(new Date(today.getFullYear(), today.getMonth(), 1));
      const monthEnd = toDateStr(new Date(today.getFullYear(), today.getMonth() + 1, 0));

      const [stats, logged, board, monthDates] = await Promise.all([
        getMyStats(),
        hasLoggedToday(),
        fetchLeaderboard(),
        fetchLoggedDates(monthStart, monthEnd),
      ]);
      setCurrentStreak(stats.currentStreak);
      setLongestStreak(stats.longestStreak);
      setTotalWorkouts(stats.totalWorkouts);
      setDisplayName(stats.displayName);
      setNameInput(stats.displayName === 'Fitness Fan' ? '' : stats.displayName);
      setLoggedToday(logged);
      setLeaderboard(board);
      setMonthLoggedDates(monthDates);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [today]);

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

  const weekDatesLogged = useMemo(() => {
    const start = startOfWeek(today);
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (monthLoggedDates.has(toDateStr(d))) count++;
    }
    return count;
  }, [monthLoggedDates, today]);

  const monthGrid = useMemo(() => {
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = firstDay.getDay();
    const cells: { day: number | null; dateStr: string | null }[] = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push({ day: null, dateStr: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, dateStr: toDateStr(new Date(year, month, d)) });
    }
    return cells;
  }, [today]);

  const todayStr = toDateStr(today);
  const gamificationMessage = loggedToday
    ? `🔥 Nice work! You're at ${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}.`
    : `🔥 Keep going! Complete today's activity to reach ${currentStreak + 1} days.`;

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
          <Text style={styles.title}>Streaks</Text>

          <View style={styles.heroRow}>
            <View style={styles.streakCard}>
              <Text style={styles.streakNumber}>{currentStreak > 0 ? '🔥' : ''} {currentStreak}</Text>
              <Text style={styles.streakLabel}>day streak</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{longestStreak}</Text>
                  <Text style={styles.statLabel}>Longest</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{totalWorkouts}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
              </View>
            </View>

            <View style={styles.ringCard}>
              <View style={styles.ringWrap}>
                <ProgressRing progress={weekDatesLogged / 7} />
                <View style={styles.ringCenter}>
                  <Text style={styles.ringValue}>{weekDatesLogged}/7</Text>
                </View>
              </View>
              <Text style={styles.ringLabel}>This week</Text>
            </View>
          </View>

          <View style={styles.gamificationBanner}>
            <Text style={styles.gamificationText}>{gamificationMessage}</Text>
          </View>

          <Pressable
            style={[styles.logButton, loggedToday && styles.logButtonDone]}
            onPress={handleLog}
            disabled={loggedToday || logging}
          >
            {logging ? (
              <ActivityIndicator color="#0a0a0a" />
            ) : (
              <Text style={styles.logButtonText}>
                {loggedToday ? "✓ Logged today's workout" : "Log today's workout"}
              </Text>
            )}
          </Pressable>

          <Text style={styles.sectionTitle}>{today.toLocaleString('default', { month: 'long' })}</Text>
          <View style={styles.calendarGrid}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <Text key={`h-${i}`} style={styles.calendarHeaderCell}>{d}</Text>
            ))}
            {monthGrid.map((cell, i) => (
              <View
                key={i}
                style={[
                  styles.calendarCell,
                  cell.dateStr && monthLoggedDates.has(cell.dateStr) && styles.calendarCellDone,
                  cell.dateStr === todayStr && styles.calendarCellToday,
                ]}
              >
                {cell.day != null && <Text style={styles.calendarCellText}>{cell.day}</Text>}
              </View>
            ))}
          </View>

          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                placeholder="Your display name"
                placeholderTextColor={dark.textFaint}
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
    marginBottom: 12,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  streakCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  streakNumber: {
    color: dark.text,
    fontSize: 34,
    fontWeight: '800',
  },
  streakLabel: {
    fontSize: 12,
    color: dark.textMuted,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: dark.border,
  },
  statValue: {
    color: dark.text,
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    color: dark.textFaint,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  ringCard: {
    width: 130,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringValue: {
    color: dark.text,
    fontSize: 16,
    fontWeight: '700',
  },
  ringLabel: {
    color: dark.textFaint,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
  gamificationBanner: {
    backgroundColor: dark.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: dark.accentDark,
    padding: 12,
    marginBottom: 12,
  },
  gamificationText: {
    color: dark.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  logButton: {
    backgroundColor: dark.accent,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  logButtonDone: {
    backgroundColor: dark.surfaceElevated,
    borderWidth: 1,
    borderColor: dark.accent,
  },
  logButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 14,
  },
  sectionTitle: {
    color: dark.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  calendarHeaderCell: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: dark.textFaint,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  calendarCellDone: {
    backgroundColor: dark.accentDark,
    borderRadius: 8,
  },
  calendarCellToday: {
    borderWidth: 1,
    borderColor: dark.accent,
    borderRadius: 8,
  },
  calendarCellText: {
    color: dark.text,
    fontSize: 12,
    fontWeight: '600',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  nameLabel: {
    fontSize: 13,
    color: dark.textMuted,
  },
  nameValue: {
    fontWeight: '700',
    color: dark.text,
  },
  nameEdit: {
    fontSize: 13,
    color: dark.accent,
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
    borderColor: dark.border,
    backgroundColor: dark.surface,
    color: dark.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  nameSave: {
    color: dark.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  error: {
    color: dark.danger,
    marginBottom: 12,
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
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  rowMe: {
    borderColor: dark.accent,
    backgroundColor: dark.surfaceElevated,
  },
  rank: {
    width: 24,
    fontSize: 13,
    color: dark.textFaint,
    fontWeight: '700',
  },
  rowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: dark.text,
  },
  rowStats: {
    alignItems: 'flex-end',
  },
  rowStreak: {
    fontSize: 13,
    fontWeight: '700',
    color: dark.text,
  },
  rowTotal: {
    fontSize: 11,
    color: dark.textFaint,
  },
});
