import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { startCheckout } from '../lib/billing';
import { askClaude, buildDailyBriefingPrompt, type CoachPersonality, type DailyBriefingData } from '../lib/claude';
import { saveHistoryEntry } from '../lib/aiHistory';
import { fetchDailyBriefingData, fetchTodaysCachedEntry } from '../lib/coachInsights';
import { dark } from '../lib/theme';

function headlineTags(data: DailyBriefingData): string {
  const tags: string[] = [];
  tags.push(
    data.sleepHours != null ? `😴 Sleep ${data.sleepHours.toFixed(1)}h` : '😴 No sleep logged'
  );
  if (data.energy != null) tags.push(`⚡ Energy ${data.energy}/5`);
  tags.push(`🔥 ${data.currentStreak} day streak`);
  return tags.join('  ·  ');
}

export default function DailyBriefingCard({
  isPremium,
  personality,
}: {
  isPremium: boolean;
  personality: CoachPersonality;
}) {
  const [data, setData] = useState<DailyBriefingData | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const briefingData = await fetchDailyBriefingData();
      setData(briefingData);

      if (isPremium) {
        const cached = await fetchTodaysCachedEntry('daily_briefing');
        if (cached) {
          setBriefing(cached);
        } else {
          setGenerating(true);
          const reply = await askClaude(buildDailyBriefingPrompt(briefingData, personality));
          setBriefing(reply);
          saveHistoryEntry('daily_briefing', reply);
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

  if (loading || !data) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={dark.accent} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>DAILY BRIEFING</Text>
      <Text style={styles.headline}>{headlineTags(data)}</Text>

      {isPremium ? (
        generating ? (
          <View style={styles.generatingRow}>
            <ActivityIndicator size="small" color={dark.accent} />
            <Text style={styles.generatingText}>Building your briefing...</Text>
          </View>
        ) : (
          <Text style={styles.body}>{briefing}</Text>
        )
      ) : (
        <>
          <View style={styles.lockedBox}>
            <View style={styles.redactedLine} />
            <View style={[styles.redactedLine, { width: '85%' }]} />
            <View style={[styles.redactedLine, { width: '60%' }]} />
          </View>
          <Pressable style={styles.unlockButton} onPress={handleUpgrade} disabled={upgrading}>
            {upgrading ? (
              <ActivityIndicator color="#0a0a0a" size="small" />
            ) : (
              <Text style={styles.unlockButtonText}>🔒 Unlock Personalized Plan</Text>
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
    borderColor: dark.accentDark,
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
    marginBottom: 6,
  },
  headline: {
    color: dark.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  body: {
    color: dark.text,
    fontSize: 14,
    lineHeight: 20,
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
  lockedBox: {
    marginBottom: 12,
  },
  redactedLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: dark.surfaceElevated,
    marginBottom: 8,
    width: '100%',
  },
  unlockButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  unlockButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 13,
  },
  error: {
    color: dark.danger,
    fontSize: 12,
    marginTop: 8,
  },
});
