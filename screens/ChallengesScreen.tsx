import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  fetchChallengeLeaderboard,
  fetchChallenges,
  fetchChallengeStats,
  fetchMyProgress,
  getChallengeStatus,
  joinChallenge,
  leaveChallenge,
} from '../lib/challenges';
import { supabase } from '../lib/supabase';
import { dark } from '../lib/theme';
import type { Challenge, ChallengeProgress } from '../lib/types';

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  upcoming: 'Upcoming',
  past: 'Ended',
};

type Tab = 'active' | 'popular' | 'new' | 'completed';
const TABS: { key: Tab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'popular', label: 'Popular' },
  { key: 'new', label: 'New' },
  { key: 'completed', label: 'Completed' },
];

export default function ChallengesScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('active');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [myProgress, setMyProgress] = useState<Record<string, ChallengeProgress>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedBoard, setExpandedBoard] = useState<ChallengeProgress[]>([]);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);

      const [list, statCounts, progress] = await Promise.all([
        fetchChallenges(),
        fetchChallengeStats(),
        fetchMyProgress(),
      ]);
      setChallenges(list);
      setStats(statCounts);
      const progressMap: Record<string, ChallengeProgress> = {};
      for (const row of progress) progressMap[row.challenge_id] = row;
      setMyProgress(progressMap);
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

  const handleJoin = async (challengeId: string) => {
    setBusyId(challengeId);
    setError(null);
    try {
      await joinChallenge(challengeId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleLeave = async (challengeId: string) => {
    setBusyId(challengeId);
    setError(null);
    try {
      await leaveChallenge(challengeId);
      if (expandedId === challengeId) setExpandedId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const toggleExpanded = async (challengeId: string) => {
    if (expandedId === challengeId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(challengeId);
    setExpandedLoading(true);
    try {
      const board = await fetchChallengeLeaderboard(challengeId);
      setExpandedBoard(board);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExpandedLoading(false);
    }
  };

  const visibleChallenges = useMemo(() => {
    switch (tab) {
      case 'active':
        return challenges
          .filter((c) => getChallengeStatus(c) === 'active')
          .sort((a, b) => a.end_date.localeCompare(b.end_date));
      case 'popular':
        return [...challenges].sort((a, b) => (stats[b.id] ?? 0) - (stats[a.id] ?? 0));
      case 'new':
        return [...challenges].sort((a, b) => b.created_at.localeCompare(a.created_at));
      case 'completed':
        return challenges.filter((c) => {
          const progress = myProgress[c.id];
          return progress && progress.workouts_logged >= c.target_workouts;
        });
    }
  }, [tab, challenges, stats, myProgress]);

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
          <Text style={styles.title}>Challenges</Text>
          <Text style={styles.subtitle}>Join a challenge and log workouts to complete it.</Text>

          <View style={styles.tabRow}>
            {TABS.map((t) => (
              <Pressable
                key={t.key}
                style={[styles.tab, tab === t.key && styles.tabActive]}
                onPress={() => setTab(t.key)}
              >
                <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}
        </>
      }
      data={visibleChallenges}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <Text style={styles.empty}>
          {tab === 'completed' ? "You haven't completed a challenge yet." : 'No challenges here yet.'}
        </Text>
      }
      renderItem={({ item: challenge }) => {
        const status = getChallengeStatus(challenge);
        const progress = myProgress[challenge.id];
        const joined = !!progress;
        const workoutsLogged = progress?.workouts_logged ?? 0;
        const complete = joined && workoutsLogged >= challenge.target_workouts;
        const pct = Math.min(1, workoutsLogged / challenge.target_workouts);
        const expanded = expandedId === challenge.id;

        return (
          <View style={styles.card}>
            <Pressable onPress={() => toggleExpanded(challenge.id)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{challenge.title}</Text>
                <View style={[styles.badge, status === 'active' && styles.badgeActive]}>
                  <Text style={[styles.badgeText, status === 'active' && styles.badgeTextActive]}>
                    {STATUS_LABEL[status]}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardDescription}>{challenge.description}</Text>
              <Text style={styles.cardMeta}>
                {challenge.start_date} → {challenge.end_date} · 🔥 {stats[challenge.id] ?? 0} participants
              </Text>

              {joined && (
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
                  </View>
                  <Text style={styles.progressText}>
                    {complete
                      ? `✓ Completed — ${workoutsLogged}/${challenge.target_workouts} Days`
                      : `Progress: ${workoutsLogged}/${challenge.target_workouts} Days`}
                  </Text>
                </View>
              )}
            </Pressable>

            <View style={styles.cardFooter}>
              <Pressable onPress={() => toggleExpanded(challenge.id)}>
                <Text style={styles.linkText}>{expanded ? 'Hide leaderboard' : 'View leaderboard'}</Text>
              </Pressable>

              {joined ? (
                <Pressable
                  style={[styles.actionButton, styles.leaveButton]}
                  onPress={() => handleLeave(challenge.id)}
                  disabled={busyId === challenge.id}
                >
                  {busyId === challenge.id ? (
                    <ActivityIndicator size="small" color={dark.danger} />
                  ) : (
                    <Text style={styles.leaveButtonText}>Leave</Text>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  style={styles.actionButton}
                  onPress={() => handleJoin(challenge.id)}
                  disabled={busyId === challenge.id}
                >
                  {busyId === challenge.id ? (
                    <ActivityIndicator size="small" color="#0a0a0a" />
                  ) : (
                    <Text style={styles.joinButtonText}>Join Challenge</Text>
                  )}
                </Pressable>
              )}
            </View>

            {expanded && (
              <View style={styles.leaderboard}>
                {expandedLoading ? (
                  <ActivityIndicator style={styles.leaderboardLoading} color={dark.accent} />
                ) : expandedBoard.length === 0 ? (
                  <Text style={styles.empty}>No one has joined yet.</Text>
                ) : (
                  expandedBoard.map((row, index) => (
                    <View
                      key={row.user_id}
                      style={[styles.row, row.user_id === userId && styles.rowMe]}
                    >
                      <Text style={styles.rank}>{index + 1}</Text>
                      <Text style={styles.rowName}>
                        {row.display_name}
                        {row.user_id === userId ? ' (you)' : ''}
                      </Text>
                      <Text style={styles.rowStat}>{row.workouts_logged} workouts</Text>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        );
      }}
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
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  tabActive: {
    backgroundColor: dark.accent,
    borderColor: dark.accent,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: dark.textMuted,
  },
  tabTextActive: {
    color: '#0a0a0a',
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
  card: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: dark.text,
    flex: 1,
  },
  badge: {
    backgroundColor: dark.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeActive: {
    backgroundColor: dark.accentDark,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: dark.textMuted,
  },
  badgeTextActive: {
    color: '#0a0a0a',
  },
  cardDescription: {
    fontSize: 13,
    color: dark.textMuted,
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 12,
    color: dark.textFaint,
  },
  progressWrap: {
    marginTop: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: dark.surfaceElevated,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: dark.accent,
  },
  progressText: {
    fontSize: 12,
    color: dark.textMuted,
    marginTop: 4,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  linkText: {
    fontSize: 13,
    color: dark.accent,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    minWidth: 72,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 13,
  },
  leaveButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: dark.danger,
  },
  leaveButtonText: {
    color: dark.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  leaderboard: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: dark.border,
    paddingTop: 12,
  },
  leaderboardLoading: {
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  rowMe: {
    borderColor: dark.accent,
    backgroundColor: dark.surfaceElevated,
  },
  rank: {
    width: 20,
    fontSize: 12,
    color: dark.textFaint,
    fontWeight: '700',
  },
  rowName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: dark.text,
  },
  rowStat: {
    fontSize: 12,
    color: dark.textMuted,
  },
});
