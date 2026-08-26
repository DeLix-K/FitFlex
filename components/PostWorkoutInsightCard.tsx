import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { startCheckout } from '../lib/billing';
import { askClaude, buildPostWorkoutInsightPrompt, type CoachPersonality } from '../lib/claude';
import { saveHistoryEntry } from '../lib/aiHistory';
import { fetchPostWorkoutInsightData, fetchTodaysCachedEntry } from '../lib/coachInsights';
import { fetchLoggedDates } from '../lib/streaks';
import { dark } from '../lib/theme';

function todayLocalDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function PostWorkoutInsightCard({
  isPremium,
  personality,
}: {
  isPremium: boolean;
  personality: CoachPersonality;
}) {
  const [visible, setVisible] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const today = todayLocalDate();
      const loggedToday = await fetchLoggedDates(today, today);
      if (!loggedToday.has(today)) {
        setVisible(false);
        return;
      }
      setVisible(true);

      if (isPremium) {
        const cached = await fetchTodaysCachedEntry('post_workout_insight');
        if (cached) {
          setInsight(cached);
        } else {
          setGenerating(true);
          const data = await fetchPostWorkoutInsightData();
          const reply = await askClaude(buildPostWorkoutInsightPrompt(data, personality));
          setInsight(reply);
          saveHistoryEntry('post_workout_insight', reply);
          setGenerating(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setGenerating(false);
    } finally {
      setLoading(false);
    }
  }, [isPremium, personality]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleUpgrade = async () => {
    setUpgrading(true);
    setError(null);
    try {
      await startCheckout();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUpgrading(false);
    }
  };

  if (loading || !visible) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>✓ POST-WORKOUT INSIGHT</Text>

      {isPremium ? (
        generating ? (
          <View style={styles.generatingRow}>
            <ActivityIndicator size="small" color={dark.accent} />
            <Text style={styles.generatingText}>Analyzing your session...</Text>
          </View>
        ) : (
          <Text style={styles.body}>{insight}</Text>
        )
      ) : (
        <>
          <Text style={styles.teaser}>
            Your AI Coach noticed something in today's numbers worth acting on.
          </Text>
          <Pressable style={styles.unlockButton} onPress={handleUpgrade} disabled={upgrading}>
            {upgrading ? (
              <ActivityIndicator color="#0a0a0a" size="small" />
            ) : (
              <Text style={styles.unlockButtonText}>🔒 Unlock Insight</Text>
            )}
          </Pressable>
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  eyebrow: {
    color: dark.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  body: {
    color: dark.text,
    fontSize: 14,
    lineHeight: 20,
  },
  teaser: {
    color: dark.textMuted,
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  generatingText: {
    color: dark.textMuted,
    fontSize: 13,
  },
  unlockButton: {
    borderWidth: 1,
    borderColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  unlockButtonText: {
    color: dark.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  error: {
    color: dark.danger,
    fontSize: 12,
    marginTop: 8,
  },
});
