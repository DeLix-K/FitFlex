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
import { colors } from '../lib/theme';
import type { Challenge, ChallengeProgress } from '../lib/types';

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  upcoming: 'Upcoming',
  past: 'Ended',
};

export default function ChallengesScreen() {
  const [userId, setUserId] = useState<string | null>(null);
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

  const sections = useMemo(() => {
    const groups: Record<'active' | 'upcoming' | 'past', Challenge[]> = {
      active: [],
      upcoming: [],
      past: [],
    };
    for (const challenge of challenges) {
      groups[getChallengeStatus(challenge)].push(challenge);
    }
    return [
      ...(groups.active.length ? [{ title: 'Active', data: groups.active }] : []),
      ...(groups.upcoming.length ? [{ title: 'Upcoming', data: groups.upcoming }] : []),
      ...(groups.past.length ? [{ title: 'Ended', data: groups.past }] : []),
    ];
  }, [challenges]);

  const flatData = useMemo(
    () => sections.flatMap((section) => [{ header: section.title }, ...section.data]),
    [sections]
  );

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
          <Text style={styles.title}>Challenges</Text>
          <Text style={styles.subtitle}>Join a challenge and log workouts to complete it.</Text>
          {error && <Text style={styles.error}>{error}</Text>}
        </>
      }
      data={flatData}
      keyExtractor={(item) =>
        'header' in item ? `header-${item.header}` : (item as Challenge).id
      }
      ListEmptyComponent={<Text style={styles.empty}>No challenges yet — check back soon.</Text>}
      renderItem={({ item }) => {
        if ('header' in item) {
          return <Text style={styles.sectionTitle}>{item.header}</Text>;
        }

        const challenge = item as Challenge;
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
                  <Text style={styles.badgeText}>{STATUS_LABEL[status]}</Text>
                </View>
              </View>
              <Text style={styles.cardDescription}>{challenge.description}</Text>
              <Text style={styles.cardMeta}>
                {challenge.start_date} → {challenge.end_date} · {stats[challenge.id] ?? 0} joined
              </Text>

              {joined && (
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
                  </View>
                  <Text style={styles.progressText}>
                    {complete
                      ? `✓ Completed — ${workoutsLogged}/${challenge.target_workouts}`
                      : `${workoutsLogged}/${challenge.target_workouts} workouts`}
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
                    <ActivityIndicator size="small" color={colors.danger} />
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
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.joinButtonText}>Join</Text>
                  )}
                </Pressable>
              )}
            </View>

            {expanded && (
              <View style={styles.leaderboard}>
                {expandedLoading ? (
                  <ActivityIndicator style={styles.leaderboardLoading} />
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 8,
  },
  empty: {
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
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
    flex: 1,
  },
  badge: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeActive: {
    backgroundColor: '#dcfce7',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 12,
    color: colors.textFaint,
  },
  progressWrap: {
    marginTop: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.backgroundMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: 12,
    color: colors.textMuted,
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
    color: colors.primary,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    minWidth: 72,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  leaveButton: {
    backgroundColor: '#fee2e2',
  },
  leaveButtonText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  leaderboard: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  leaderboardLoading: {
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  rowMe: {
    borderColor: colors.primary,
    backgroundColor: '#eff6ff',
  },
  rank: {
    width: 20,
    fontSize: 12,
    color: colors.textFaint,
    fontWeight: '700',
  },
  rowName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#222',
  },
  rowStat: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
