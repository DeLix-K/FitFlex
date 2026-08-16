import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ExercisePicker from '../components/ExercisePicker';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import type { Exercise, WorkoutPlan, WorkoutPlanExercise } from '../lib/types';

export default function PlanDetailScreen({
  planId,
  onBack,
  onDeleted,
}: {
  planId: string;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [items, setItems] = useState<WorkoutPlanExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const draftRef = useRef<Record<string, Partial<Record<'sets' | 'reps' | 'notes', string>>>>({});

  const fetchAll = useCallback(async () => {
    setError(null);
    const [planResult, itemsResult] = await Promise.all([
      supabase.from('workout_plans').select('*').eq('id', planId).single(),
      supabase
        .from('workout_plan_exercises')
        .select('*, exercises(id, name, category)')
        .eq('workout_plan_id', planId)
        .order('order_index', { ascending: true }),
    ]);

    if (planResult.error) {
      setError(planResult.error.message);
      return;
    }
    if (itemsResult.error) {
      setError(itemsResult.error.message);
      return;
    }
    setPlan(planResult.data);
    setItems((itemsResult.data as WorkoutPlanExercise[]) ?? []);
  }, [planId]);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const addExercise = async (exercise: Exercise) => {
    setPickerVisible(false);
    const nextOrder = items.length;
    const { data, error: insertError } = await supabase
      .from('workout_plan_exercises')
      .insert({ workout_plan_id: planId, exercise_id: exercise.id, order_index: nextOrder })
      .select('*, exercises(id, name, category)')
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setItems([...items, data as WorkoutPlanExercise]);
  };

  const removeItem = async (itemId: string) => {
    const { error: deleteError } = await supabase
      .from('workout_plan_exercises')
      .delete()
      .eq('id', itemId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setItems(items.filter((i) => i.id !== itemId));
  };

  const setDraft = (itemId: string, field: 'sets' | 'reps' | 'notes', text: string) => {
    draftRef.current[itemId] = { ...draftRef.current[itemId], [field]: text };
  };

  const saveField = async (itemId: string, field: 'sets' | 'reps' | 'notes') => {
    const value = draftRef.current[itemId]?.[field];
    if (value === undefined) return;

    const parsed = field === 'notes' ? value : value === '' ? null : Number(value);
    if (field !== 'notes' && value !== '' && Number.isNaN(parsed)) return;

    setItems((current) =>
      current.map((i) => (i.id === itemId ? { ...i, [field]: parsed } : i))
    );
    await supabase
      .from('workout_plan_exercises')
      .update({ [field]: parsed })
      .eq('id', itemId);
  };

  const move = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const reordered = [...items];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setItems(reordered);

    await Promise.all([
      supabase
        .from('workout_plan_exercises')
        .update({ order_index: index })
        .eq('id', reordered[index].id),
      supabase
        .from('workout_plan_exercises')
        .update({ order_index: targetIndex })
        .eq('id', reordered[targetIndex].id),
    ]);
  };

  const deletePlan = async () => {
    const { error: deleteError } = await supabase.from('workout_plans').delete().eq('id', planId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onDeleted();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>{'< My Plans'}</Text>
      </Pressable>

      <Text style={styles.title}>{plan?.name}</Text>
      {plan?.description ? <Text style={styles.description}>{plan.description}</Text> : null}

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>No exercises in this plan yet. Add one below.</Text>
        }
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.exerciseName}>{item.exercises.name}</Text>
              <Pressable onPress={() => removeItem(item.id)}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>

            <View style={styles.fieldsRow}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Sets</Text>
                <TextInput
                  style={styles.fieldInput}
                  keyboardType="number-pad"
                  defaultValue={item.sets != null ? String(item.sets) : ''}
                  onChangeText={(text) => setDraft(item.id, 'sets', text)}
                  onBlur={() => saveField(item.id, 'sets')}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Reps</Text>
                <TextInput
                  style={styles.fieldInput}
                  keyboardType="number-pad"
                  defaultValue={item.reps != null ? String(item.reps) : ''}
                  onChangeText={(text) => setDraft(item.id, 'reps', text)}
                  onBlur={() => saveField(item.id, 'reps')}
                />
              </View>
              <View style={styles.reorderButtons}>
                <Pressable onPress={() => move(index, -1)} disabled={index === 0}>
                  <Text style={[styles.reorderText, index === 0 && styles.reorderDisabled]}>
                    Up
                  </Text>
                </Pressable>
                <Pressable onPress={() => move(index, 1)} disabled={index === items.length - 1}>
                  <Text
                    style={[
                      styles.reorderText,
                      index === items.length - 1 && styles.reorderDisabled,
                    ]}
                  >
                    Down
                  </Text>
                </Pressable>
              </View>
            </View>

            <TextInput
              style={styles.notesInput}
              placeholder="Notes (optional)"
              defaultValue={item.notes ?? ''}
              onChangeText={(text) => setDraft(item.id, 'notes', text)}
              onBlur={() => saveField(item.id, 'notes')}
            />
          </View>
        )}
      />

      <Pressable style={styles.addButton} onPress={() => setPickerVisible(true)}>
        <Text style={styles.addButtonText}>+ Add Exercise</Text>
      </Pressable>

      {confirmingDelete ? (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmText}>Delete this plan?</Text>
          <Pressable onPress={deletePlan}>
            <Text style={styles.confirmYes}>Yes, delete</Text>
          </Pressable>
          <Pressable onPress={() => setConfirmingDelete(false)}>
            <Text style={styles.confirmNo}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setConfirmingDelete(true)}>
          <Text style={styles.deletePlan}>Delete Plan</Text>
        </Pressable>
      )}

      <ExercisePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={addExercise}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  back: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  error: {
    color: '#dc2626',
    marginTop: 12,
  },
  empty: {
    color: '#888',
    textAlign: 'center',
    marginTop: 24,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 12,
  },
  row: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
  },
  remove: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
  fieldsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  field: {
    width: 70,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  reorderButtons: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 'auto',
  },
  reorderText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  reorderDisabled: {
    color: '#ccc',
  },
  notesInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 13,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  deletePlan: {
    color: '#dc2626',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    fontWeight: '600',
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  confirmText: {
    color: '#444',
  },
  confirmYes: {
    color: '#dc2626',
    fontWeight: '700',
  },
  confirmNo: {
    color: '#666',
    fontWeight: '600',
  },
});
