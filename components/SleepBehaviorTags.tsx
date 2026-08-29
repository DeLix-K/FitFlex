import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BEHAVIOR_TAGS, fetchBehaviorTags, setBehaviorTag } from '../lib/sleep';
import { dark } from '../lib/theme';
import type { SleepBehaviorTag } from '../lib/types';

export default function SleepBehaviorTags({ sleepDate }: { sleepDate: string }) {
  const [selected, setSelected] = useState<Set<SleepBehaviorTag>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyTag, setBusyTag] = useState<SleepBehaviorTag | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchBehaviorTags(sleepDate)
      .then((tags) => setSelected(new Set(tags)))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [sleepDate]);

  const toggle = async (tag: SleepBehaviorTag) => {
    const willEnable = !selected.has(tag);
    setBusyTag(tag);
    setError(null);
    // Optimistic update, reconciled on failure.
    setSelected((prev) => {
      const next = new Set(prev);
      if (willEnable) next.add(tag);
      else next.delete(tag);
      return next;
    });
    try {
      await setBehaviorTag(sleepDate, tag, willEnable);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSelected((prev) => {
        const next = new Set(prev);
        if (willEnable) next.delete(tag);
        else next.add(tag);
        return next;
      });
    } finally {
      setBusyTag(null);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>What affected your sleep last night?</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {loading ? (
        <ActivityIndicator color={dark.accent} style={{ marginTop: 8 }} />
      ) : (
        <View style={styles.chipsWrap}>
          {BEHAVIOR_TAGS.map(({ tag, label, emoji }) => {
            const active = selected.has(tag);
            return (
              <Pressable
                key={tag}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggle(tag)}
                disabled={busyTag === tag}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {emoji} {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  title: {
    color: dark.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  error: {
    color: dark.danger,
    fontSize: 12,
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipActive: {
    borderColor: dark.accent,
    backgroundColor: dark.surfaceElevated,
  },
  chipText: {
    color: dark.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: dark.accent,
  },
});
