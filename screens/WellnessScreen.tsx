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
import AiUsageIndicator from '../components/AiUsageIndicator';
import { useAiGate } from '../hooks/useAiGate';
import { colors } from '../lib/theme';
import type { MoodLog } from '../lib/types';
import { fetchMoodHistory, logMood, reflectOnMood, todayLocalDate } from '../lib/wellness';

const MOODS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Very low' },
  { value: 2, emoji: '🙁', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

function moodEmoji(mood: number): string {
  return MOODS.find((m) => m.value === mood)?.emoji ?? '😐';
}

export default function WellnessScreen() {
  const [history, setHistory] = useState<MoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mood, setMood] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [reflecting, setReflecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aiGate = useAiGate();

  const today = todayLocalDate();
  const todayEntry = history.find((h) => h.log_date === today) ?? null;

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchMoodHistory();
      setHistory(data);
      const existing = data.find((h) => h.log_date === todayLocalDate());
      if (existing) {
        setMood(existing.mood);
        setNotes(existing.notes);
      }
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

  const handleSave = async () => {
    if (mood == null) {
      setError('Pick how you\'re feeling first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await logMood({ logDate: today, mood, notes });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReflect = async () => {
    if (!todayEntry) return;
    if (!aiGate.canUse) {
      setError("You've used today's free AI actions. Upgrade to Premium for unlimited access.");
      return;
    }
    setReflecting(true);
    setError(null);
    try {
      await reflectOnMood(todayEntry.id, todayEntry.mood, todayEntry.notes);
      aiGate.refresh();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReflecting(false);
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
          <Text style={styles.title}>Mental Wellness</Text>
          <Text style={styles.subtitle}>
            Check in with how you're feeling. This isn't a substitute for professional support —
            if you're struggling, please reach out to someone who can help.
          </Text>
          <AiUsageIndicator
            isPremium={aiGate.isPremium}
            remaining={aiGate.remaining}
            loaded={aiGate.loaded}
          />
          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.form}>
            <Text style={styles.formLabel}>How are you feeling today?</Text>
            <View style={styles.moodRow}>
              {MOODS.map((m) => (
                <Pressable
                  key={m.value}
                  style={[styles.moodButton, mood === m.value && styles.moodButtonSelected]}
                  onPress={() => setMood(m.value)}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text
                    style={[styles.moodLabel, mood === m.value && styles.moodLabelSelected]}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.notesInput}
              placeholder="What's on your mind? (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {todayEntry ? 'Update Today\'s Check-in' : 'Save Check-in'}
                </Text>
              )}
            </Pressable>

            {todayEntry && !todayEntry.ai_reflection && (
              <Pressable
                style={styles.reflectButton}
                onPress={handleReflect}
                disabled={reflecting}
              >
                {reflecting ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={styles.reflectButtonText}>Reflect with AI</Text>
                )}
              </Pressable>
            )}

            {todayEntry?.ai_reflection && (
              <View style={styles.reflectionCard}>
                <Text style={styles.reflectionLabel}>AI Reflection</Text>
                <Text style={styles.reflectionText}>{todayEntry.ai_reflection}</Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Recent Check-ins</Text>
        </>
      }
      data={history.filter((h) => h.log_date !== today)}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<Text style={styles.empty}>No past check-ins yet.</Text>}
      renderItem={({ item }) => (
        <View style={styles.historyRow}>
          <Text style={styles.historyEmoji}>{moodEmoji(item.mood)}</Text>
          <View style={styles.historyMiddle}>
            <Text style={styles.historyDate}>{item.log_date}</Text>
            {item.notes ? <Text style={styles.historyNotes}>{item.notes}</Text> : null}
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
  },
  subtitle: {
    fontSize: 13,
    color: colors.textFaint,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 18,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
  },
  form: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  moodButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    flex: 1,
  },
  moodButtonSelected: {
    backgroundColor: '#eff6ff',
    borderColor: colors.primary,
  },
  moodEmoji: {
    fontSize: 24,
  },
  moodLabel: {
    fontSize: 10,
    color: colors.textFaint,
    marginTop: 4,
    textAlign: 'center',
  },
  moodLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  reflectButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reflectButtonText: {
    color: colors.primary,
    fontWeight: '700',
  },
  reflectionCard: {
    marginTop: 12,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 8,
    padding: 12,
  },
  reflectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 4,
  },
  reflectionText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  empty: {
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 12,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  historyEmoji: {
    fontSize: 22,
  },
  historyMiddle: {
    flex: 1,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: '700',
  },
  historyNotes: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
