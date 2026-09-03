import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import EmptyStateCard from '../components/EmptyStateCard';
import FillRemainingMacrosCard from '../components/FillRemainingMacrosCard';
import InstantLogBar from '../components/InstantLogBar';
import LogMealModal, { type LogMealMode } from '../components/LogMealModal';
import MacroFuelRing from '../components/MacroFuelRing';
import MealTimelineCard from '../components/MealTimelineCard';
import MenuScannerModal from '../components/MenuScannerModal';
import type { Tab } from '../components/AppShell';
import { deleteMeal, estimateWorkoutCalories, fetchMealsForDate, fetchTodayWorkoutMinutes, todayLocalDate } from '../lib/nutrition';
import { computeTargets, fetchBodyStats } from '../lib/profile';
import { dark } from '../lib/theme';
import type { MealLog, MealType } from '../lib/types';

const MEAL_TYPES: { value: MealType; label: string; icon: string }[] = [
  { value: 'breakfast', label: 'Breakfast', icon: '🍳' },
  { value: 'lunch', label: 'Lunch', icon: '🥗' },
  { value: 'dinner', label: 'Dinner', icon: '🍽️' },
  { value: 'snack', label: 'Snacks', icon: '🍎' },
];

export default function NutritionScreen({ onNavigate }: { onNavigate?: (tab: Tab) => void }) {
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [targets, setTargets] = useState<{ calories: number; proteinGrams: number; carbGrams: number; fatGrams: number } | null>(null);
  const [workoutMinutes, setWorkoutMinutes] = useState(0);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logMode, setLogMode] = useState<LogMealMode | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [mealsData, stats, minutes] = await Promise.all([
        fetchMealsForDate(todayLocalDate()),
        fetchBodyStats(),
        fetchTodayWorkoutMinutes(),
      ]);
      setMeals(mealsData);
      setTargets(stats ? computeTargets(stats) : null);
      setWeightKg(stats?.weight_kg ?? null);
      setWorkoutMinutes(minutes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const totals = useMemo(() => {
    return meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + Number(m.protein_g),
        carbs: acc.carbs + Number(m.carbs_g),
        fat: acc.fat + Number(m.fat_g),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [meals]);

  const workoutCalories = weightKg && workoutMinutes > 0 ? estimateWorkoutCalories(workoutMinutes, weightKg) : 0;
  const calorieTarget = (targets?.calories ?? 0) + workoutCalories;

  const remaining = {
    calories: calorieTarget - totals.calories,
    protein: (targets?.proteinGrams ?? 0) - totals.protein,
    carbs: (targets?.carbGrams ?? 0) - totals.carbs,
    fat: (targets?.fatGrams ?? 0) - totals.fat,
  };

  const removeMeal = async (id: string) => {
    try {
      await deleteMeal(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Nutrition</Text>
          <Pressable onPress={() => onNavigate?.('profile')}>
            <Text style={styles.goalsLink}>⚙️ Goals</Text>
          </Pressable>
        </View>

        {targets ? (
          <MacroFuelRing
            calories={totals.calories}
            calorieTarget={calorieTarget}
            workoutCaloriesBurned={workoutCalories}
            protein={totals.protein}
            proteinTarget={targets.proteinGrams}
            carbs={totals.carbs}
            carbTarget={targets.carbGrams}
            fat={totals.fat}
            fatTarget={targets.fatGrams}
          />
        ) : (
          <View style={styles.noTargetsCard}>
            <Text style={styles.noTargetsText}>Add your height, weight, age, and goal on your Profile to see daily targets.</Text>
            <Pressable style={styles.noTargetsButton} onPress={() => onNavigate?.('profile')}>
              <Text style={styles.noTargetsButtonText}>Set Up Profile</Text>
            </Pressable>
          </View>
        )}

        <InstantLogBar
          onSnap={() => setLogMode('snap')}
          onVoice={() => setLogMode('voice')}
          onBarcode={() => setLogMode('barcode')}
          onSearch={() => setLogMode('search')}
          onMenu={() => setMenuOpen(true)}
        />

        {targets && <FillRemainingMacrosCard remaining={remaining} />}

        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.sectionTitle}>Today's Timeline</Text>
        {meals.length === 0 && (
          <EmptyStateCard
            image={require('../assets/photos/empty_nutrition.jpg')}
            title="Nothing logged today"
            subtitle="Snap a photo, search, or scan a barcode above to start your timeline."
          />
        )}
        {meals.length > 0 && MEAL_TYPES.map((mt) => {
          const mealsForType = meals.filter((m) => m.meal_type === mt.value);
          return (
            <View key={mt.value} style={styles.mealSection}>
              <Text style={styles.mealSectionTitle}>
                {mt.icon} {mt.label}
              </Text>
              {mealsForType.length === 0 ? (
                <Text style={styles.mealEmpty}>Nothing logged yet.</Text>
              ) : (
                mealsForType.map((m) => <MealTimelineCard key={m.id} meal={m} onRemove={() => removeMeal(m.id)} />)
              )}
            </View>
          );
        })}
      </ScrollView>

      <LogMealModal
        visible={logMode != null}
        mode={logMode ?? 'search'}
        onClose={() => setLogMode(null)}
        onSaved={load}
      />
      <MenuScannerModal visible={menuOpen} onClose={() => setMenuOpen(false)} onSaved={load} remaining={remaining} />
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
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
  goalsLink: {
    color: dark.accent,
    fontWeight: '600',
    fontSize: 13,
  },
  noTargetsCard: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  noTargetsText: {
    color: dark.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  noTargetsButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  noTargetsButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 13,
  },
  error: {
    color: dark.danger,
    marginBottom: 12,
  },
  sectionTitle: {
    color: dark.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 4,
  },
  mealSection: {
    marginBottom: 16,
  },
  mealSectionTitle: {
    color: dark.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  mealEmpty: {
    color: dark.textFaint,
    fontSize: 12,
  },
});
