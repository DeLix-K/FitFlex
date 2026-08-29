import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createHabit } from '../lib/habits';
import { dark } from '../lib/theme';
import type { HabitAutoSyncSource, HabitTimeOfDay, HabitType } from '../lib/types';

type Template = {
  key: string;
  label: string;
  emoji: string;
  name: string;
  habitType: HabitType;
  targetValue: number | null;
  unit: string | null;
  timeOfDay: HabitTimeOfDay;
  autoSyncSource: HabitAutoSyncSource | null;
};

const TEMPLATES: Template[] = [
  {
    key: 'water',
    label: 'Drink Water',
    emoji: '💧',
    name: 'Drink Water',
    habitType: 'numeric',
    targetValue: 2000,
    unit: 'ml',
    timeOfDay: 'anytime',
    autoSyncSource: null,
  },
  {
    key: 'sleep',
    label: 'Sleep 7+ Hours',
    emoji: '🛏️',
    name: 'Sleep 7+ Hours',
    habitType: 'numeric',
    targetValue: 420,
    unit: 'min',
    timeOfDay: 'morning',
    autoSyncSource: 'sleep_duration',
  },
  {
    key: 'steps',
    label: '8,000 Steps',
    emoji: '🚶',
    name: 'Walk 8,000 Steps',
    habitType: 'numeric',
    targetValue: 8000,
    unit: 'steps',
    timeOfDay: 'evening',
    autoSyncSource: 'oura_steps',
  },
  {
    key: 'workout',
    label: 'Complete a Workout',
    emoji: '🏋️',
    name: 'Complete a Workout',
    habitType: 'boolean',
    targetValue: null,
    unit: null,
    timeOfDay: 'anytime',
    autoSyncSource: 'workout_done',
  },
  {
    key: 'vitamins',
    label: 'Take Vitamins',
    emoji: '💊',
    name: 'Take Creatine & Multivitamin',
    habitType: 'boolean',
    targetValue: null,
    unit: null,
    timeOfDay: 'morning',
    autoSyncSource: null,
  },
  {
    key: 'read',
    label: 'Read 10 Pages',
    emoji: '📖',
    name: 'Read 10 Pages',
    habitType: 'boolean',
    targetValue: null,
    unit: null,
    timeOfDay: 'evening',
    autoSyncSource: null,
  },
];

const CUSTOM_TEMPLATE: Template = {
  key: 'custom',
  label: 'Custom',
  emoji: '✏️',
  name: '',
  habitType: 'boolean',
  targetValue: null,
  unit: null,
  timeOfDay: 'anytime',
  autoSyncSource: null,
};

const TIME_OPTIONS: { key: HabitTimeOfDay; label: string }[] = [
  { key: 'anytime', label: 'Anytime' },
  { key: 'morning', label: 'Morning' },
  { key: 'midday', label: 'Mid-Day' },
  { key: 'evening', label: 'Evening' },
];

export default function CreateHabitModal({ visible, onClose, onCreated }: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [selectedKey, setSelectedKey] = useState(TEMPLATES[0].key);
  const [name, setName] = useState(TEMPLATES[0].name);
  const [habitType, setHabitType] = useState<HabitType>(TEMPLATES[0].habitType);
  const [targetValue, setTargetValue] = useState(TEMPLATES[0].targetValue?.toString() ?? '');
  const [unit, setUnit] = useState(TEMPLATES[0].unit ?? '');
  const [timeOfDay, setTimeOfDay] = useState<HabitTimeOfDay>(TEMPLATES[0].timeOfDay);
  const [autoSyncSource, setAutoSyncSource] = useState<HabitAutoSyncSource | null>(TEMPLATES[0].autoSyncSource);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyTemplate = (t: Template) => {
    setSelectedKey(t.key);
    setName(t.name);
    setHabitType(t.habitType);
    setTargetValue(t.targetValue?.toString() ?? '');
    setUnit(t.unit ?? '');
    setTimeOfDay(t.timeOfDay);
    setAutoSyncSource(t.autoSyncSource);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Give your habit a name.');
      return;
    }
    if (habitType === 'numeric' && (!targetValue || Number(targetValue) <= 0)) {
      setError('Enter a target amount greater than 0.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createHabit({
        name,
        habitType,
        targetValue: habitType === 'numeric' ? Number(targetValue) : null,
        unit: habitType === 'numeric' ? unit.trim() || null : null,
        timeOfDay,
        autoSyncSource,
      });
      applyTemplate(TEMPLATES[0]);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>New Habit</Text>
              <Pressable onPress={onClose}>
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Start from a template</Text>
            <View style={styles.templateWrap}>
              {[...TEMPLATES, CUSTOM_TEMPLATE].map((t) => (
                <Pressable
                  key={t.key}
                  style={[styles.templateChip, selectedKey === t.key && styles.templateChipActive]}
                  onPress={() => applyTemplate(t)}
                >
                  <Text
                    style={[styles.templateChipText, selectedKey === t.key && styles.templateChipTextActive]}
                  >
                    {t.emoji} {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Stretch before bed"
              placeholderTextColor={dark.textFaint}
            />

            <Text style={styles.label}>Type</Text>
            <View style={styles.rowChips}>
              <Pressable
                style={[styles.smallChip, habitType === 'boolean' && styles.smallChipActive]}
                onPress={() => setHabitType('boolean')}
              >
                <Text style={[styles.smallChipText, habitType === 'boolean' && styles.smallChipTextActive]}>
                  Yes/No
                </Text>
              </Pressable>
              <Pressable
                style={[styles.smallChip, habitType === 'numeric' && styles.smallChipActive]}
                onPress={() => setHabitType('numeric')}
              >
                <Text style={[styles.smallChipText, habitType === 'numeric' && styles.smallChipTextActive]}>
                  Target amount
                </Text>
              </Pressable>
            </View>

            {habitType === 'numeric' && (
              <View style={styles.rowChips}>
                <TextInput
                  style={[styles.input, styles.inputHalf]}
                  value={targetValue}
                  onChangeText={setTargetValue}
                  placeholder="e.g. 2000"
                  placeholderTextColor={dark.textFaint}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.inputHalf]}
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="unit (ml, pages...)"
                  placeholderTextColor={dark.textFaint}
                />
              </View>
            )}

            <Text style={styles.label}>When</Text>
            <View style={styles.rowChips}>
              {TIME_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[styles.smallChip, timeOfDay === opt.key && styles.smallChipActive]}
                  onPress={() => setTimeOfDay(opt.key)}
                >
                  <Text style={[styles.smallChipText, timeOfDay === opt.key && styles.smallChipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {autoSyncSource && (
              <Text style={styles.autoNote}>
                ⚡ This habit will auto-complete from real data already in the app — no manual
                check-in needed once the threshold is met.
              </Text>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable style={styles.createButton} onPress={handleCreate} disabled={creating}>
              {creating ? (
                <ActivityIndicator color="#0a0a0a" size="small" />
              ) : (
                <Text style={styles.createButtonText}>Create Habit</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: dark.background,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 16,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    color: dark.text,
    fontSize: 17,
    fontWeight: '800',
  },
  close: {
    color: dark.accent,
    fontWeight: '700',
  },
  label: {
    color: dark.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 12,
  },
  templateWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateChip: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  templateChipActive: {
    borderColor: dark.accent,
    backgroundColor: dark.surfaceElevated,
  },
  templateChipText: {
    color: dark.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  templateChipTextActive: {
    color: dark.accent,
  },
  input: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    color: dark.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputHalf: {
    flex: 1,
  },
  rowChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallChip: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  smallChipActive: {
    borderColor: dark.accent,
    backgroundColor: dark.surfaceElevated,
  },
  smallChipText: {
    color: dark.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  smallChipTextActive: {
    color: dark.accent,
  },
  autoNote: {
    color: dark.textFaint,
    fontSize: 11,
    marginTop: 12,
    lineHeight: 16,
  },
  error: {
    color: dark.danger,
    fontSize: 12,
    marginTop: 12,
  },
  createButton: {
    backgroundColor: dark.accent,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 4,
  },
  createButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 14,
  },
});
