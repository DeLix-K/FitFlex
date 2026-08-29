import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import AiUsageIndicator from '../components/AiUsageIndicator';
import CreateCustomExerciseModal from '../components/CreateCustomExerciseModal';
import ExerciseCard from '../components/ExerciseCard';
import MuscleBodyMap from '../components/MuscleBodyMap';
import QuickAddToPlanModal from '../components/QuickAddToPlanModal';
import ExerciseDetailScreen from './ExerciseDetailScreen';
import { useAiGate } from '../hooks/useAiGate';
import { supabase } from '../lib/supabase';
import {
  deleteCustomExercise,
  fetchExercises,
  fetchSavedExerciseIds,
  setExerciseSaved,
} from '../lib/exercises';
import { dark } from '../lib/theme';
import type { Exercise, ExerciseCategory } from '../lib/types';

type Tab = 'all' | 'saved' | 'custom';

const CATEGORY_FILTERS: { label: string; value: ExerciseCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Home', value: 'home' },
  { label: 'Outdoor', value: 'outdoor' },
  { label: 'Gym', value: 'gym' },
];

export default function ExerciseListScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [categoryFilter, setCategoryFilter] = useState<ExerciseCategory | 'all'>('all');
  const [equipmentFilter, setEquipmentFilter] = useState<string | null>(null);
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [quickAddExercise, setQuickAddExercise] = useState<Exercise | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const aiGate = useAiGate();

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      setUserId(userData.user?.id ?? null);
      const [ex, saved] = await Promise.all([fetchExercises(), fetchSavedExerciseIds()]);
      setExercises(ex);
      setSavedIds(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const muscleGroups = useMemo(() => {
    const set = new Set<string>();
    for (const e of exercises) for (const mg of e.muscle_groups) set.add(mg);
    return [...set].sort();
  }, [exercises]);

  const equipmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of exercises) for (const eq of e.equipment) set.add(eq);
    return [...set].sort();
  }, [exercises]);

  const filtered = exercises
    .filter((e) => tab !== 'saved' || savedIds.has(e.id))
    .filter((e) => tab !== 'custom' || e.created_by === userId)
    .filter((e) => categoryFilter === 'all' || e.category === categoryFilter)
    .filter((e) => !muscleFilter || e.muscle_groups.includes(muscleFilter))
    .filter((e) => !equipmentFilter || e.equipment.includes(equipmentFilter))
    .filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase()));

  const toggleSave = async (item: Exercise) => {
    setSavingId(item.id);
    const isSaved = savedIds.has(item.id);
    try {
      await setExerciseSaved(item.id, !isSaved);
      setSavedIds((s) => {
        const next = new Set(s);
        if (isSaved) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteCustom = async (id: string) => {
    try {
      await deleteCustomExercise(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const selectedExercise = exercises.find((e) => e.id === selectedExerciseId) ?? null;
  if (selectedExercise) {
    return (
      <ExerciseDetailScreen
        exercise={selectedExercise}
        allExercises={exercises}
        saved={savedIds.has(selectedExercise.id)}
        onToggleSave={() => toggleSave(selectedExercise)}
        onBack={() => setSelectedExerciseId(null)}
        onNavigateToExercise={(e) => setSelectedExerciseId(e.id)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.usageRow}>
        <AiUsageIndicator isPremium={aiGate.isPremium} remaining={aiGate.remaining} loaded={aiGate.loaded} />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          placeholderTextColor={dark.textFaint}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.tabRow}>
        {(['all', 'saved', 'custom'] as Tab[]).map((t) => (
          <Pressable key={t} style={[styles.tabChip, tab === t && styles.tabChipActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabChipText, tab === t && styles.tabChipTextActive]}>
              {t === 'all' ? 'All' : t === 'saved' ? '★ Saved' : '✎ Custom'}
            </Text>
          </Pressable>
        ))}
      </View>

      <MuscleBodyMap availableMuscles={muscleGroups} selected={muscleFilter} onSelect={setMuscleFilter} />

      <View style={styles.filterRow}>
        {CATEGORY_FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={[styles.filterChip, categoryFilter === f.value && styles.filterChipActive]}
            onPress={() => setCategoryFilter(f.value)}
          >
            <Text style={[styles.filterChipText, categoryFilter === f.value && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {equipmentOptions.length > 0 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.equipmentRow}
          contentContainerStyle={styles.equipmentContent}
          data={equipmentOptions}
          keyExtractor={(eq) => eq}
          renderItem={({ item: eq }) => (
            <Pressable
              style={[styles.equipmentChip, equipmentFilter === eq && styles.equipmentChipActive]}
              onPress={() => setEquipmentFilter(equipmentFilter === eq ? null : eq)}
            >
              <Text style={[styles.equipmentChipText, equipmentFilter === eq && styles.equipmentChipTextActive]}>
                {eq}
              </Text>
            </Pressable>
          )}
        />
      )}

      {tab === 'custom' && (
        <Pressable style={styles.createCustomButton} onPress={() => setCreateModalVisible(true)}>
          <Text style={styles.createCustomButtonText}>+ New Custom Exercise</Text>
        </Pressable>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={dark.accent} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>
            {tab === 'custom'
              ? 'No custom exercises yet — add one above.'
              : tab === 'saved'
                ? 'No saved exercises yet — tap the star on any exercise.'
                : 'No exercises match these filters.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={dark.accent} />}
          renderItem={({ item }) => (
            <View>
              <ExerciseCard
                exercise={item}
                saved={savedIds.has(item.id)}
                savingId={savingId}
                onPress={() => setSelectedExerciseId(item.id)}
                onToggleSave={() => toggleSave(item)}
                onQuickAdd={() => setQuickAddExercise(item)}
              />
              {tab === 'custom' && item.created_by === userId && (
                <Pressable style={styles.deleteCustomButton} onPress={() => handleDeleteCustom(item.id)}>
                  <Text style={styles.deleteCustomButtonText}>Delete custom exercise</Text>
                </Pressable>
              )}
            </View>
          )}
        />
      )}

      <QuickAddToPlanModal
        visible={!!quickAddExercise}
        exerciseId={quickAddExercise?.id ?? null}
        exerciseName={quickAddExercise?.name ?? ''}
        onClose={() => setQuickAddExercise(null)}
      />

      <CreateCustomExerciseModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreated={() => {
          setCreateModalVisible(false);
          load();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
  },
  usageRow: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  searchRow: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    color: dark.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  tabChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: dark.surface,
    borderWidth: 1,
    borderColor: dark.border,
  },
  tabChipActive: {
    backgroundColor: dark.accent,
    borderColor: dark.accent,
  },
  tabChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: dark.textMuted,
  },
  tabChipTextActive: {
    color: '#0a0a0a',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 10,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: dark.surface,
    borderWidth: 1,
    borderColor: dark.border,
  },
  filterChipActive: {
    backgroundColor: dark.accent,
    borderColor: dark.accent,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: dark.textMuted,
  },
  filterChipTextActive: {
    color: '#0a0a0a',
  },
  equipmentRow: {
    marginBottom: 12,
  },
  equipmentContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  equipmentChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: dark.border,
  },
  equipmentChipActive: {
    backgroundColor: dark.surfaceElevated,
    borderColor: dark.accent,
  },
  equipmentChipText: {
    fontSize: 12,
    color: dark.textFaint,
    textTransform: 'capitalize',
  },
  equipmentChipTextActive: {
    color: dark.accent,
    fontWeight: '600',
  },
  createCustomButton: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: dark.accent,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  createCustomButtonText: {
    color: dark.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  error: {
    color: dark.danger,
    textAlign: 'center',
  },
  empty: {
    color: dark.textFaint,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  deleteCustomButton: {
    marginTop: -6,
    marginBottom: 12,
    alignItems: 'center',
  },
  deleteCustomButtonText: {
    color: dark.danger,
    fontSize: 11,
    fontWeight: '600',
  },
});
