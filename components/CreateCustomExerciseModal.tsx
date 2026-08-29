import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { createCustomExercise } from '../lib/exercises';
import { dark } from '../lib/theme';
import type { ExerciseCategory } from '../lib/types';

const CATEGORIES: ExerciseCategory[] = ['home', 'outdoor', 'gym'];

export default function CreateCustomExerciseModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('gym');
  const [muscleGroups, setMuscleGroups] = useState('');
  const [equipment, setEquipment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setCategory('gym');
    setMuscleGroups('');
    setEquipment('');
    setError(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Give it a name.');
      return;
    }
    if (!muscleGroups.trim()) {
      setError('List at least one muscle group (primary first).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createCustomExercise({
        name,
        category,
        muscleGroups: muscleGroups.split(',').map((m) => m.trim().toLowerCase()).filter(Boolean),
        equipment: equipment.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
      });
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>New Custom Exercise</Text>
          <Text style={styles.hint}>Private to you — never shown to other users.</Text>

          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={dark.textFaint}
            value={name}
            onChangeText={setName}
          />

          <View style={styles.chipsRow}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                style={[styles.chip, category === c && styles.chipActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Muscle groups, primary first (e.g. chest, triceps)"
            placeholderTextColor={dark.textFaint}
            value={muscleGroups}
            onChangeText={setMuscleGroups}
          />
          <TextInput
            style={styles.input}
            placeholder="Equipment, comma-separated (blank = bodyweight)"
            placeholderTextColor={dark.textFaint}
            value={equipment}
            onChangeText={setEquipment}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.createButton} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.createButtonText}>Create</Text>}
            </Pressable>
          </View>
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
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: dark.background,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    color: dark.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  hint: {
    color: dark.textFaint,
    fontSize: 11,
    marginBottom: 14,
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
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chipActive: {
    borderColor: dark.accent,
    backgroundColor: dark.surfaceElevated,
  },
  chipText: {
    color: dark.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: dark.accent,
  },
  error: {
    color: dark.danger,
    fontSize: 12,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: dark.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  createButton: {
    flex: 1,
    backgroundColor: dark.accent,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 13,
  },
});
