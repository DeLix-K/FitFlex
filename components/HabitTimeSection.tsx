import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';
import type { HabitWithStatus } from '../lib/types';
import HabitCard from './HabitCard';

const SECTION_META: Record<string, { label: string; emoji: string; hint: string }> = {
  morning: { label: 'Morning Priming', emoji: '🌅', hint: '4:00 AM – 12:00 PM' },
  midday: { label: 'Mid-Day Fuel', emoji: '☀️', hint: '12:00 PM – 5:00 PM' },
  evening: { label: 'Evening Wind-Down', emoji: '🌙', hint: '5:00 PM – 4:00 AM' },
};

export default function HabitTimeSection({
  timeOfDay,
  habits,
  isActive,
  busyId,
  onToggleBoolean,
  onSaveProgress,
  onDelete,
}: {
  timeOfDay: 'morning' | 'midday' | 'evening';
  habits: HabitWithStatus[];
  isActive: boolean;
  busyId: string | null;
  onToggleBoolean: (habit: HabitWithStatus) => void;
  onSaveProgress: (habit: HabitWithStatus, value: number) => void;
  onDelete: (habitId: string) => void;
}) {
  const [expanded, setExpanded] = useState(isActive);
  const meta = SECTION_META[timeOfDay];
  const doneCount = habits.filter((h) => h.done_today).length;

  if (habits.length === 0) return null;

  return (
    <View style={styles.section}>
      <Pressable style={styles.header} onPress={() => setExpanded((e) => !e)}>
        <Text style={styles.headerText}>
          {isActive ? 'ACTIVE: ' : ''}
          {meta.emoji} {meta.label.toUpperCase()}
        </Text>
        <Text style={styles.headerMeta}>
          {expanded ? `${meta.hint} ▾` : `${doneCount}/${habits.length} done ▸`}
        </Text>
      </Pressable>

      {expanded ? (
        habits.map((habit) => (
          <HabitCard
            key={habit.id}
            habit={habit}
            busy={busyId === habit.id}
            onToggleBoolean={() => onToggleBoolean(habit)}
            onSaveProgress={(value) => onSaveProgress(habit, value)}
            onDelete={() => onDelete(habit.id)}
          />
        ))
      ) : (
        <View style={styles.collapsedRow}>
          <Text style={styles.collapsedText}>{habits.map((h) => h.name).join(' · ')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerText: {
    color: dark.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerMeta: {
    color: dark.textFaint,
    fontSize: 11,
    fontWeight: '600',
  },
  collapsedRow: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 12,
    padding: 12,
  },
  collapsedText: {
    color: dark.textMuted,
    fontSize: 12,
  },
});
