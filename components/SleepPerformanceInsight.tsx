import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { startCheckout } from '../lib/billing';
import { fetchWorkoutLogHistory } from '../lib/habits';
import { fetchSleepHistory } from '../lib/sleep';
import { calm } from '../lib/theme';
import { computeSleepPerformanceCorrelation, type SleepPerformanceInsight as Insight } from '../lib/wellness';

export default function SleepPerformanceInsight({ isPremium }: { isPremium: boolean }) {
  const [insight, setInsight] = useState<Insight>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (!isPremium) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [workoutHistory, sleepHistory] = await Promise.all([
          fetchWorkoutLogHistory(60),
          fetchSleepHistory(60),
        ]);
        const workoutDates = new Set(workoutHistory.map((w) => w.logged_date));
        setInsight(computeSleepPerformanceCorrelation(workoutDates, sleepHistory));
      } catch {
        setInsight(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [isPremium]);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await startCheckout();
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>📊 Sleep-to-Performance Insight</Text>

      {!isPremium ? (
        <>
          <View style={styles.lockedBox}>
            <View style={styles.redactedLine} />
            <View style={[styles.redactedLine, { width: '70%' }]} />
          </View>
          <Pressable style={styles.unlockButton} onPress={handleUpgrade} disabled={upgrading}>
            {upgrading ? (
              <ActivityIndicator color="#0a2420" size="small" />
            ) : (
              <Text style={styles.unlockButtonText}>🔒 Unlock with Premium</Text>
            )}
          </Pressable>
        </>
      ) : loading ? (
        <ActivityIndicator color={calm.accent} />
      ) : insight ? (
        <Text style={styles.text}>
          On nights after a training day, your Oura sleep score averages {insight.trainDayAvgScore}
          {' '}({insight.nightsTrain} nights) vs {insight.restDayAvgScore} on rest days (
          {insight.nightsRest} nights) — {Math.abs(Math.round(insight.pctDiff * 100))}%{' '}
          {insight.pctDiff >= 0 ? 'higher' : 'lower'} on training days.
        </Text>
      ) : (
        <Text style={styles.emptyText}>
          Keep syncing Oura sleep data and logging workouts — once there's enough history on both
          training and rest days, a real comparison will show up here.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: calm.accentDark,
    backgroundColor: calm.surfaceElevated,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  title: {
    color: calm.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  text: {
    color: calm.text,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyText: {
    color: calm.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  lockedBox: {
    marginBottom: 12,
  },
  redactedLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: calm.surface,
    marginBottom: 8,
    width: '100%',
  },
  unlockButton: {
    backgroundColor: calm.accent,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  unlockButtonText: {
    color: '#0a2420',
    fontWeight: '700',
    fontSize: 13,
  },
});
