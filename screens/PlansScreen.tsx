import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { dark } from '../lib/theme';
import type { PlanScheduleEntry, WorkoutPlan } from '../lib/types';
import PlanDetailScreen from './PlanDetailScreen';

type PlansView = { mode: 'list' } | { mode: 'new' } | { mode: 'detail'; planId: string };

// weekday follows JS Date#getDay() (0 = Sunday); displayed Mon-Sun per spec.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABELS: Record<number, string> = {
  0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT',
};

export default function PlansScreen({ session }: { session: Session }) {
  const [view, setView] = useState<PlansView>({ mode: 'list' });
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [schedule, setSchedule] = useState<PlanScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [pickerWeekday, setPickerWeekday] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    const [plansResult, scheduleResult] = await Promise.all([
      supabase.from('workout_plans').select('*').order('updated_at', { ascending: false }),
      supabase.from('plan_schedule').select('*').eq('user_id', session.user.id),
    ]);

    if (plansResult.error) setError(plansResult.error.message);
    else setPlans(plansResult.data ?? []);

    if (scheduleResult.error) setError(scheduleResult.error.message);
    else setSchedule(scheduleResult.data ?? []);
  }, [session.user.id]);

  useEffect(() => {
    if (view.mode !== 'list') return;
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [view.mode, fetchAll]);

  const createPlan = async () => {
    if (!newName.trim()) {
      setError('Please give your plan a name.');
      return;
    }
    setCreating(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('workout_plans')
      .insert({ user_id: session.user.id, name: newName.trim(), description: newDescription.trim() })
      .select()
      .single();
    setCreating(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewName('');
    setNewDescription('');
    setView({ mode: 'detail', planId: data.id });
  };

  const assignDay = async (weekday: number, planId: string | null) => {
    setPickerWeekday(null);
    const { error: upsertError } = await supabase
      .from('plan_schedule')
      .upsert({ user_id: session.user.id, weekday, plan_id: planId }, { onConflict: 'user_id,weekday' });
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    await fetchAll();
  };

  if (view.mode === 'detail') {
    return (
      <PlanDetailScreen
        planId={view.planId}
        onBack={() => setView({ mode: 'list' })}
        onDeleted={() => setView({ mode: 'list' })}
      />
    );
  }

  if (view.mode === 'new') {
    return (
      <View style={styles.container}>
        <Pressable onPress={() => setView({ mode: 'list' })}>
          <Text style={styles.back}>{'< My Plans'}</Text>
        </Pressable>
        <Text style={styles.title}>New Plan</Text>

        <TextInput
          style={styles.input}
          placeholder="Plan name (e.g. Push Day)"
          placeholderTextColor={dark.textFaint}
          value={newName}
          onChangeText={setNewName}
        />
        <TextInput
          style={styles.input}
          placeholder="Description (optional)"
          placeholderTextColor={dark.textFaint}
          value={newDescription}
          onChangeText={setNewDescription}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.createButton} onPress={createPlan} disabled={creating}>
          {creating ? (
            <ActivityIndicator color="#0a0a0a" />
          ) : (
            <Text style={styles.createButtonText}>Create Plan</Text>
          )}
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={dark.accent} />
      </View>
    );
  }

  const todayWeekday = new Date().getDay();
  const todayEntry = schedule.find((s) => s.weekday === todayWeekday);
  const todayPlan = todayEntry?.plan_id ? plans.find((p) => p.id === todayEntry.plan_id) : null;
  const planById = new Map(plans.map((p) => [p.id, p]));

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>My Plans</Text>
        <Pressable onPress={() => setView({ mode: 'new' })}>
          <Text style={styles.newPlan}>+ New Plan</Text>
        </Pressable>
      </View>

      <FlatList
        data={plans}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>YOUR CURRENT PLAN</Text>
              <Text style={styles.heroTitle}>{todayPlan?.name ?? 'No plan scheduled for today'}</Text>
              {todayPlan ? (
                <Pressable
                  style={styles.heroButton}
                  onPress={() => setView({ mode: 'detail', planId: todayPlan.id })}
                >
                  <Text style={styles.heroButtonText}>Start Today's Workout</Text>
                </Pressable>
              ) : (
                <Text style={styles.heroSubtitle}>
                  {plans.length > 0 ? 'Set today in your weekly schedule below.' : 'Create a plan to get started.'}
                </Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>Weekly Schedule</Text>
            {WEEKDAY_ORDER.map((wd) => {
              const entry = schedule.find((s) => s.weekday === wd);
              const plan = entry?.plan_id ? planById.get(entry.plan_id) : null;
              const isToday = wd === todayWeekday;
              return (
                <Pressable
                  key={wd}
                  style={[styles.scheduleRow, isToday && styles.scheduleRowToday]}
                  onPress={() => setPickerWeekday(wd)}
                >
                  <Text style={styles.scheduleDay}>{WEEKDAY_LABELS[wd]}</Text>
                  <Text style={styles.schedulePlan}>{plan ? plan.name : 'Rest'}</Text>
                  {isToday && <Text style={styles.scheduleTodayTag}>Today</Text>}
                </Pressable>
              );
            })}

            {error && <Text style={styles.error}>{error}</Text>}
            <Text style={styles.sectionTitle}>All Plans</Text>
          </>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            You haven't created any workout plans yet. Tap "+ New Plan" to build one.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => setView({ mode: 'detail', planId: item.id })}
          >
            <Text style={styles.cardName}>{item.name}</Text>
            {item.description ? (
              <Text style={styles.cardDescription}>{item.description}</Text>
            ) : null}
          </Pressable>
        )}
      />

      <Modal
        visible={pickerWeekday != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerWeekday(null)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setPickerWeekday(null)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>
              {pickerWeekday != null ? WEEKDAY_LABELS[pickerWeekday] : ''} plan
            </Text>
            <Pressable
              style={styles.pickerOption}
              onPress={() => pickerWeekday != null && assignDay(pickerWeekday, null)}
            >
              <Text style={styles.pickerOptionText}>Rest</Text>
            </Pressable>
            {plans.map((p) => (
              <Pressable
                key={p.id}
                style={styles.pickerOption}
                onPress={() => pickerWeekday != null && assignDay(pickerWeekday, p.id)}
              >
                <Text style={styles.pickerOptionText}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: dark.text,
    fontSize: 22,
    fontWeight: '700',
  },
  newPlan: {
    color: dark.accent,
    fontWeight: '600',
  },
  back: {
    color: dark.accent,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  centered: {
    flex: 1,
    backgroundColor: dark.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  empty: {
    color: dark.textFaint,
    textAlign: 'center',
  },
  error: {
    color: dark.danger,
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 40,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
  },
  heroLabel: {
    color: dark.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  heroTitle: {
    color: dark.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  heroSubtitle: {
    color: dark.textMuted,
    fontSize: 13,
  },
  heroButton: {
    backgroundColor: dark.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  heroButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
  sectionTitle: {
    color: dark.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 4,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  scheduleRowToday: {
    borderColor: dark.accent,
  },
  scheduleDay: {
    color: dark.textFaint,
    fontSize: 12,
    fontWeight: '700',
    width: 44,
  },
  schedulePlan: {
    color: dark.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  scheduleTodayTag: {
    color: dark.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
    color: dark.text,
  },
  cardDescription: {
    fontSize: 14,
    color: dark.textMuted,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    color: dark.text,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    fontSize: 16,
  },
  createButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  createButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    backgroundColor: dark.surface,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 16,
    padding: 16,
  },
  pickerTitle: {
    color: dark.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  pickerOption: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: dark.border,
  },
  pickerOptionText: {
    color: dark.text,
    fontSize: 14,
  },
});
