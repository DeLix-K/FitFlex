import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { startCheckout } from '../lib/billing';
import { fetchTodaysCachedEntry } from '../lib/coachInsights';
import { calm } from '../lib/theme';
import { contextualRecommendation, generateWellnessRecommendation } from '../lib/wellness';

export default function WellnessRecommendationCard({
  isPremium,
  wellnessScore,
  mood,
  stress,
  energy,
  recoveryScore,
  sleepHours,
}: {
  isPremium: boolean;
  wellnessScore: number | null;
  mood: number | null;
  stress: number | null;
  energy: number | null;
  recoveryScore: number | null;
  sleepHours: number | null;
}) {
  const [aiText, setAiText] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = { wellnessScore, mood, stress, energy, recoveryScore, sleepHours };

  const load = useCallback(async () => {
    if (!isPremium) return;
    try {
      const cached = await fetchTodaysCachedEntry('wellness_recommendation');
      if (cached) {
        setAiText(cached);
        return;
      }
      setGenerating(true);
      const reply = await generateWellnessRecommendation(params);
      setAiText(reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium]);

  useEffect(() => {
    load();
  }, [load]);

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
      <Text style={styles.eyebrow}>TODAY'S RECOMMENDATION</Text>
      <Text style={styles.freeText}>{contextualRecommendation(wellnessScore)}</Text>

      {isPremium ? (
        generating ? (
          <View style={styles.generatingRow}>
            <ActivityIndicator size="small" color={calm.accent} />
            <Text style={styles.generatingText}>Personalizing for today...</Text>
          </View>
        ) : aiText ? (
          <View style={styles.aiBox}>
            <Text style={styles.aiLabel}>✨ AI Personalized</Text>
            <Text style={styles.aiText}>{aiText}</Text>
          </View>
        ) : null
      ) : (
        <>
          <View style={styles.lockedBox}>
            <View style={styles.redactedLine} />
            <View style={[styles.redactedLine, { width: '80%' }]} />
          </View>
          <Pressable style={styles.unlockButton} onPress={handleUpgrade} disabled={upgrading}>
            {upgrading ? (
              <ActivityIndicator color="#0a2420" size="small" />
            ) : (
              <Text style={styles.unlockButtonText}>🔒 Unlock AI Personalization</Text>
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
    borderColor: calm.border,
    backgroundColor: calm.surface,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  eyebrow: {
    color: calm.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  freeText: {
    color: calm.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  generatingText: {
    color: calm.textMuted,
    fontSize: 13,
  },
  aiBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: calm.border,
  },
  aiLabel: {
    color: calm.accent,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  aiText: {
    color: calm.text,
    fontSize: 13,
    lineHeight: 19,
  },
  lockedBox: {
    marginTop: 14,
    marginBottom: 12,
  },
  redactedLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: calm.surfaceElevated,
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
  error: {
    color: calm.danger,
    fontSize: 12,
    marginTop: 10,
  },
});
