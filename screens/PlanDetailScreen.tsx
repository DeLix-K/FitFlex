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
import SmartSwapModal from '../components/SmartSwapModal';
import ThemeEmojiPicker from '../components/ThemeEmojiPicker';
import { fetchExercises } from '../lib/exercises';
import { finishSession, updatePlanStyle } from '../lib/plans';
import { supabase } from '../lib/supabase';
import { dark } from '../lib/theme';
import type { Exercise, WorkoutPlan, WorkoutPlanExercise } from '../lib/types';

export default function PlanDetailScreen({
  planId,
  onBack,
  onDeleted,
  sessionMode,
  programId,
  isPremium,
  onSessionFinished,
}: {
  planId: string;
  onBack: () => void;
  onDeleted: () => void;
  sessionMode?: boolean;
  programId?: string | null;
  isPremium: boolean;
  onSessionFinished?: () => void;
}) {
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [items, setItems] = useState<WorkoutPlanExercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [swapVisible, setSwapVisible] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(false);
  const draftRef = useRef<Record<string, Partial<Record<'sets' | 'reps' | 'notes', string>>>>({});
  const sessionStartRef = useRef<number>(Date.now());

  const fetchAll = useCallback(async () => {
    setError(null);
    const [planResult, itemsResult, exercises] = await Promise.all([
      supabase.from('workout_plans').select('*').eq('id', planId).single(),
      supabase
        .from('workout_plan_exercises')
        .select('*, exercises(id, name, category, muscle_groups, equipment, fatigue_tier)')
        .eq('workout_plan_id', planId)
        .order('order_index', { ascending: true }),
      fetchExercises(),
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
    setAllExercises(exercises);
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
      .select('*, exercises(id, name, category, muscle_groups, equipment, fatigue_tier)')
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

  const changeTheme = async (themeKey: WorkoutPlan['theme_key']) => {
    setPlan((p) => (p ? { ...p, theme_key: themeKey } : p));
    await updatePlanStyle(planId, { themeKey }).catch((err) => setError(err.message));
  };

  const changeEmoji = async (emoji: string) => {
    setPlan((p) => (p ? { ...p, emoji } : p));
    await updatePlanStyle(planId, { emoji }).catch((err) => setError(err.message));
  };

  const finishWorkout = async () => {
    setFinishing(true);
    setError(null);
    try {
      const durationMinutes = Math.max(1, Math.round((Date.now() - sessionStartRef.current) / 60000));
      await finishSession({ planId, programId: programId ?? null, durationMinutes });
      setFinished(true);
      onSessionFinished?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={dark.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <Pressable onPress={onBack}>
              <Text style={styles.back}>{'< My Plans'}</Text>
            </Pressable>

            <View style={styles.titleRow}>
              <Text style={styles.emoji}>{plan?.emoji ?? '💪'}</Text>
              <View style={styles.titleTextWrap}>
                <Text style={styles.title}>{plan?.name}</Text>
                {plan?.description ? <Text style={styles.description}>{plan.description}</Text> : null}
              </View>
            </View>

            {sessionMode && !finished && (
              <View style={styles.sessionBanner}>
                <Text style={styles.sessionBannerText}>🏋️ Session in progress — work through the list below</Text>
                <Pressable style={styles.finishButton} onPress={finishWorkout} disabled={finishing}>
                  {finishing ? (
                    <ActivityIndicator color="#0a0a0a" />
                  ) : (
                    <Text style={styles.finishButtonText}>Finish & Log Workout</Text>
                  )}
                </Pressable>
              </View>
            )}
            {sessionMode && finished && (
              <View style={styles.sessionBanner}>
                <Text style={styles.sessionBannerText}>✅ Workout logged. Nice work.</Text>
                <Pressable style={styles.finishButton} onPress={onBack}>
                  <Text style={styles.finishButtonText}>Back to My Plans</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.actionRow}>
              <Pressable style={styles.actionChip} onPress={() => setSwapVisible(true)}>
                <Text style={styles.actionChipText}>{isPremium ? '🔁' : '🔒'} Smart Swap All</Text>
              </Pressable>
              <Pressable style={styles.actionChip} onPress={() => setCustomizeOpen((v) => !v)}>
                <Text style={styles.actionChipText}>🎨 {customizeOpen ? 'Hide Customize' : 'Customize'}</Text>
              </Pressable>
            </View>

            {customizeOpen && plan && (
              <View style={styles.customizeBox}>
                <ThemeEmojiPicker
                  themeKey={plan.theme_key}
                  emoji={plan.emoji}
                  isPremium={isPremium}
                  onChangeTheme={changeTheme}
                  onChangeEmoji={changeEmoji}
                />
              </View>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
          </>
        }
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
                  placeholderTextColor={dark.textFaint}
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
                  placeholderTextColor={dark.textFaint}
                  defaultValue={item.reps != null ? String(item.reps) : ''}
                  onChangeText={(text) => setDraft(item.id, 'reps', text)}
                  onBlur={() => saveField(item.id, 'reps')}
                />
              </View>
              <View style={styles.reorderButtons}>
                <Pressable onPress={() => move(index, -1)} disabled={index === 0}>
                  <Text style={[styles.reorderText, index === 0 && styles.reorderDisabled]}>Up</Text>
                </Pressable>
                <Pressable onPress={() => move(index, 1)} disabled={index === items.length - 1}>
                  <Text
                    style={[styles.reorderText, index === items.length - 1 && styles.reorderDisabled]}
                  >
                    Down
                  </Text>
                </Pressable>
              </View>
            </View>

            <TextInput
              style={styles.notesInput}
              placeholder="Notes (optional)"
              placeholderTextColor={dark.textFaint}
              defaultValue={item.notes ?? ''}
              onChangeText={(text) => setDraft(item.id, 'notes', text)}
              onBlur={() => saveField(item.id, 'notes')}
            />
          </View>
        )}
        ListFooterComponent={
          <>
            <Pressable style={styles.addButton} onPress={() => setPickerVisible(true)}>
              <Text style={styles.addButtonText}>+ Add Exercise</Text>
            </Pressable>

            {sessionMode && !finished && (
              <Pressable style={styles.finishButton} onPress={finishWorkout} disabled={finishing}>
                {finishing ? (
                  <ActivityIndicator color="#0a0a0a" />
                ) : (
                  <Text style={styles.finishButtonText}>Finish & Log Workout</Text>
                )}
              </Pressable>
            )}

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
          </>
        }
      />

      <ExercisePicker visible={pickerVisible} onClose={() => setPickerVisible(false)} onSelect={addExercise} />
      <SmartSwapModal
        visible={swapVisible}
        onClose={() => setSwapVisible(false)}
        items={items}
        allExercises={allExercises}
        isPremium={isPremium}
        onApplied={fetchAll}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
  },
  centered: {
    flex: 1,
    backgroundColor: dark.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  back: {
    color: dark.accent,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  emoji: {
    fontSize: 32,
  },
  titleTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: dark.text,
  },
  description: {
    fontSize: 14,
    color: dark.textMuted,
    marginTop: 2,
  },
  sessionBanner: {
    borderWidth: 1,
    borderColor: dark.accent,
    backgroundColor: dark.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  sessionBannerText: {
    color: dark.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  actionChip: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionChipText: {
    color: dark.text,
    fontSize: 12,
    fontWeight: '700',
  },
  customizeBox: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  error: {
    color: dark.danger,
    marginBottom: 12,
  },
  empty: {
    color: dark.textFaint,
    textAlign: 'center',
    marginTop: 24,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  row: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
    color: dark.text,
    flex: 1,
  },
  remove: {
    color: dark.danger,
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
    color: dark.textFaint,
    marginBottom: 4,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.background,
    color: dark.text,
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
    color: dark.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  reorderDisabled: {
    color: dark.textFaint,
  },
  notesInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.background,
    color: dark.text,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 13,
  },
  addButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
  finishButton: {
    backgroundColor: dark.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  finishButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
  deletePlan: {
    color: dark.danger,
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
    color: dark.textMuted,
  },
  confirmYes: {
    color: dark.danger,
    fontWeight: '700',
  },
  confirmNo: {
    color: dark.textMuted,
    fontWeight: '600',
  },
});
