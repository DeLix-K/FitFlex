import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { primaryMuscle, secondaryMuscles } from '../lib/exercises';
import { dark } from '../lib/theme';
import type { Exercise } from '../lib/types';

const FATIGUE_COLOR: Record<string, string> = {
  low: '#22d3ee',
  moderate: '#fb923c',
  high: '#f87171',
};

const FATIGUE_LABEL: Record<string, string> = {
  low: 'Low Fatigue',
  moderate: 'Moderate Fatigue',
  high: 'High Systemic Fatigue',
};

function safeHaptic(fn: () => Promise<void>) {
  fn().catch(() => {});
}

export default function ExerciseCard({
  exercise,
  saved,
  savingId,
  onPress,
  onToggleSave,
  onQuickAdd,
}: {
  exercise: Exercise;
  saved: boolean;
  savingId: string | null;
  onPress: () => void;
  onToggleSave: () => void;
  onQuickAdd: () => void;
}) {
  const primary = primaryMuscle(exercise);
  const secondary = secondaryMuscles(exercise);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{exercise.name}</Text>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
            onToggleSave();
          }}
          disabled={savingId === exercise.id}
          hitSlop={8}
        >
          <Text style={styles.saveIcon}>{saved ? '★' : '☆'}</Text>
        </Pressable>
      </View>

      <View style={styles.muscleRow}>
        {primary && (
          <View style={styles.primaryBadge}>
            <Text style={styles.primaryBadgeText}>{primary}</Text>
          </View>
        )}
        {secondary.map((m) => (
          <View key={m} style={styles.secondaryBadge}>
            <Text style={styles.secondaryBadgeText}>{m}</Text>
          </View>
        ))}
      </View>

      <View style={styles.tagRow}>
        <Text style={styles.equipmentTag}>
          {exercise.equipment.length > 0 ? exercise.equipment.join(', ') : 'Bodyweight'}
        </Text>
        {exercise.fatigue_tier && (
          <Text style={[styles.fatigueTag, { color: FATIGUE_COLOR[exercise.fatigue_tier] }]}>
            {FATIGUE_LABEL[exercise.fatigue_tier]}
          </Text>
        )}
      </View>

      <Pressable
        style={styles.quickAddButton}
        onPress={(e) => {
          e.stopPropagation();
          onQuickAdd();
        }}
      >
        <Text style={styles.quickAddButtonText}>+ Add to Plan</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: dark.text,
    flex: 1,
  },
  saveIcon: {
    fontSize: 20,
    color: dark.accent,
  },
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  primaryBadge: {
    backgroundColor: dark.accent,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  primaryBadgeText: {
    color: '#0a0a0a',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  secondaryBadge: {
    borderWidth: 1,
    borderColor: dark.accentDark,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  secondaryBadgeText: {
    color: dark.accent,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  equipmentTag: {
    color: dark.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  fatigueTag: {
    fontSize: 12,
    fontWeight: '700',
  },
  quickAddButton: {
    borderWidth: 1,
    borderColor: dark.accent,
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  quickAddButtonText: {
    color: dark.accent,
    fontWeight: '700',
    fontSize: 12,
  },
});
