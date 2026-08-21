import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AiUsageIndicator from '../components/AiUsageIndicator';
import { useAiGate } from '../hooks/useAiGate';
import { saveHistoryEntry } from '../lib/aiHistory';
import { askClaude, buildNutritionSearchPrompt } from '../lib/claude';
import { addMeal, deleteMeal, fetchMealsForDate, todayLocalDate } from '../lib/nutrition';
import { computeTargets, fetchBodyStats } from '../lib/profile';
import { dark } from '../lib/theme';
import type { MealLog, MealType } from '../lib/types';
import { searchUsdaFoods, type UsdaFoodMatch } from '../lib/usda';

const MEAL_TYPES: { value: MealType; label: string; icon: string }[] = [
  { value: 'breakfast', label: 'Breakfast', icon: '🍳' },
  { value: 'lunch', label: 'Lunch', icon: '🥗' },
  { value: 'dinner', label: 'Dinner', icon: '🍽️' },
  { value: 'snack', label: 'Snacks', icon: '🍎' },
];

function MacroBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(1, current / target) : 0;
  return (
    <View style={styles.macroRow}>
      <View style={styles.macroHeaderRow}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>{Math.round(current)}g / {target}g</Text>
      </View>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function NutritionSearchScreen() {
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [targets, setTargets] = useState<{ calories: number; proteinGrams: number; carbGrams: number; fatGrams: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addMealType, setAddMealType] = useState<MealType>('snack');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<UsdaFoodMatch[]>([]);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const aiGate = useAiGate();

  const load = useCallback(async () => {
    setError(null);
    try {
      const [mealsData, stats] = await Promise.all([
        fetchMealsForDate(todayLocalDate()),
        fetchBodyStats(),
      ]);
      setMeals(mealsData);
      setTargets(stats ? computeTargets(stats) : null);
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

  const openAdd = (mealType: MealType) => {
    setAddMealType(mealType);
    setQuery('');
    setMatches([]);
    setAiResult(null);
    setError(null);
    setAddOpen(true);
  };

  const search = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    setError(null);
    setAiResult(null);
    setMatches([]);
    try {
      const usdaMatches = await searchUsdaFoods(trimmed);
      if (usdaMatches.length > 0) {
        setMatches(usdaMatches);
        return;
      }
    } catch {
      // fall through to AI
    } finally {
      setSearching(false);
    }

    if (!aiGate.canUse) {
      setError("You've used today's free AI actions. Upgrade to Premium for unlimited access.");
      return;
    }
    setSearching(true);
    try {
      const reply = await askClaude(buildNutritionSearchPrompt(trimmed));
      setAiResult(reply);
      saveHistoryEntry('nutrition_search', reply, trimmed);
      aiGate.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  };

  const addFromMatch = async (match: UsdaFoodMatch) => {
    try {
      await addMeal({
        logDate: todayLocalDate(),
        mealType: addMealType,
        description: match.description,
        calories: Math.round(match.calories ?? 0),
        proteinG: Math.round(match.protein ?? 0),
        carbsG: Math.round(match.carbs ?? 0),
        fatG: Math.round(match.fat ?? 0),
        source: 'search',
      });
      setAddOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
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

  const calorieTarget = targets?.calories ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Nutrition</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryValue}>
          🔥 {Math.round(totals.calories)}{calorieTarget > 0 ? ` / ${calorieTarget}` : ''} kcal
        </Text>
        {calorieTarget > 0 ? (
          <View style={styles.summaryTrack}>
            <View style={[styles.summaryFill, { width: `${Math.min(100, (totals.calories / calorieTarget) * 100)}%` }]} />
          </View>
        ) : (
          <Text style={styles.summaryHint}>Add body stats on your Profile to see a daily target.</Text>
        )}
      </View>

      {targets && (
        <View style={styles.macrosCard}>
          <MacroBar label="Protein" current={totals.protein} target={targets.proteinGrams} color="#f87171" />
          <MacroBar label="Carbs" current={totals.carbs} target={targets.carbGrams} color="#38bdf8" />
          <MacroBar label="Fat" current={totals.fat} target={targets.fatGrams} color="#facc15" />
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {MEAL_TYPES.map((mt) => {
        const mealsForType = meals.filter((m) => m.meal_type === mt.value);
        return (
          <View key={mt.value} style={styles.mealSection}>
            <View style={styles.mealSectionHeader}>
              <Text style={styles.mealSectionTitle}>{mt.icon} {mt.label}</Text>
              <Pressable onPress={() => openAdd(mt.value)}>
                <Text style={styles.mealAdd}>+ Add</Text>
              </Pressable>
            </View>
            {mealsForType.length === 0 ? (
              <Text style={styles.mealEmpty}>Nothing logged yet.</Text>
            ) : (
              mealsForType.map((m) => (
                <View key={m.id} style={styles.mealRow}>
                  <View style={styles.mealRowInfo}>
                    <Text style={styles.mealRowName}>{m.description}</Text>
                    <Text style={styles.mealRowMacros}>
                      {m.calories} kcal · P{Math.round(Number(m.protein_g))} C{Math.round(Number(m.carbs_g))} F{Math.round(Number(m.fat_g))}
                    </Text>
                  </View>
                  <Pressable onPress={() => removeMeal(m.id)}>
                    <Text style={styles.mealRemove}>Remove</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        );
      })}

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to {MEAL_TYPES.find((m) => m.value === addMealType)?.label}</Text>
              <Pressable onPress={() => setAddOpen(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </Pressable>
            </View>

            <AiUsageIndicator isPremium={aiGate.isPremium} remaining={aiGate.remaining} loaded={aiGate.loaded} />

            <TextInput
              style={styles.input}
              placeholder="Search a food (e.g. chicken breast)"
              placeholderTextColor={dark.textFaint}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={search}
              returnKeyType="search"
            />
            <Pressable style={styles.searchButton} onPress={search} disabled={searching || !query.trim()}>
              {searching ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.searchButtonText}>Search</Text>}
            </Pressable>

            <ScrollView style={styles.modalResults}>
              {matches.map((match) => (
                <Pressable key={match.fdcId} style={styles.matchRow} onPress={() => addFromMatch(match)}>
                  <Text style={styles.matchDescription}>{match.description}</Text>
                  <Text style={styles.matchCalories}>
                    {match.calories !== null ? `${Math.round(match.calories)} kcal` : ''}
                  </Text>
                </Pressable>
              ))}

              {aiResult && (
                <View style={styles.aiResultBox}>
                  <Text style={styles.aiResultText}>{aiResult}</Text>
                  <Text style={styles.aiResultHint}>
                    AI results aren't precise enough to auto-add — search a more specific food name above to find a real database match instead.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    backgroundColor: dark.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: dark.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  summaryValue: {
    color: dark.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  summaryTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: dark.surfaceElevated,
    overflow: 'hidden',
  },
  summaryFill: {
    height: 10,
    borderRadius: 5,
    backgroundColor: dark.accent,
  },
  summaryHint: {
    color: dark.textFaint,
    fontSize: 12,
  },
  macrosCard: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  macroRow: {
    marginBottom: 12,
  },
  macroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  macroLabel: {
    color: dark.text,
    fontSize: 13,
    fontWeight: '600',
  },
  macroValue: {
    color: dark.textFaint,
    fontSize: 12,
  },
  macroTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: dark.surfaceElevated,
    overflow: 'hidden',
  },
  macroFill: {
    height: 8,
    borderRadius: 4,
  },
  error: {
    color: dark.danger,
    marginBottom: 12,
  },
  mealSection: {
    marginBottom: 16,
  },
  mealSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealSectionTitle: {
    color: dark.text,
    fontSize: 15,
    fontWeight: '700',
  },
  mealAdd: {
    color: dark.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  mealEmpty: {
    color: dark.textFaint,
    fontSize: 12,
  },
  mealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  mealRowInfo: {
    flex: 1,
    paddingRight: 8,
  },
  mealRowName: {
    color: dark.text,
    fontSize: 13,
    fontWeight: '600',
  },
  mealRowMacros: {
    color: dark.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  mealRemove: {
    color: dark.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: dark.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: dark.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: dark.text,
    fontSize: 17,
    fontWeight: '700',
  },
  modalClose: {
    color: dark.accent,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    color: dark.text,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginTop: 8,
  },
  searchButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  searchButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
  modalResults: {
    marginTop: 12,
  },
  matchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  matchDescription: {
    fontSize: 13,
    color: dark.text,
    flexShrink: 1,
    marginRight: 8,
  },
  matchCalories: {
    fontSize: 12,
    color: dark.textMuted,
    fontWeight: '600',
  },
  aiResultBox: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 10,
    padding: 12,
  },
  aiResultText: {
    fontSize: 13,
    color: dark.text,
    lineHeight: 19,
  },
  aiResultHint: {
    fontSize: 11,
    color: dark.textFaint,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
