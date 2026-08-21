import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AiUsageIndicator from '../components/AiUsageIndicator';
import { useAiGate } from '../hooks/useAiGate';
import { saveHistoryEntry } from '../lib/aiHistory';
import { askClaude, buildExerciseExplanationPrompt } from '../lib/claude';
import { supabase } from '../lib/supabase';
import { dark } from '../lib/theme';
import type { Exercise, ExerciseCategory } from '../lib/types';

type AiState = { loading: boolean; text?: string; error?: string };

const FILTERS: { label: string; value: ExerciseCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Home', value: 'home' },
  { label: 'Outdoor', value: 'outdoor' },
  { label: 'Gym', value: 'gym' },
];

export default function ExerciseListScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ExerciseCategory | 'all'>('all');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiExplanations, setAiExplanations] = useState<Record<string, AiState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const aiGate = useAiGate();

  const fetchExercises = useCallback(async () => {
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const [exResult, savedResult] = await Promise.all([
      supabase.from('exercises').select('*').order('name', { ascending: true }),
      userId
        ? supabase.from('saved_exercises').select('exercise_id').eq('user_id', userId)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (exResult.error) {
      setError(exResult.error.message);
    } else {
      setExercises(exResult.data ?? []);
    }
    setSavedIds(new Set((savedResult.data ?? []).map((r: { exercise_id: string }) => r.exercise_id)));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchExercises().finally(() => setLoading(false));
  }, [fetchExercises]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchExercises();
    setRefreshing(false);
  }, [fetchExercises]);

  // Derived from the real muscle_groups data rather than a hardcoded list,
  // so filters never reference a group that isn't actually in the catalog.
  const muscleGroups = useMemo(() => {
    const set = new Set<string>();
    for (const e of exercises) for (const mg of e.muscle_groups) set.add(mg);
    return [...set].sort();
  }, [exercises]);

  const filtered = exercises
    .filter((e) => filter === 'all' || e.category === filter)
    .filter((e) => !muscleFilter || e.muscle_groups.includes(muscleFilter))
    .filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase()));

  const askAi = async (item: Exercise) => {
    if (!aiGate.canUse) {
      setAiExplanations((current) => ({
        ...current,
        [item.id]: {
          loading: false,
          error: "You've used today's free AI actions. Upgrade to Premium for unlimited access.",
        },
      }));
      return;
    }

    setAiExplanations((current) => ({ ...current, [item.id]: { loading: true } }));
    try {
      const reply = await askClaude(buildExerciseExplanationPrompt(item));
      setAiExplanations((current) => ({ ...current, [item.id]: { loading: false, text: reply } }));
      saveHistoryEntry('exercise_explanation', reply, item.name);
      aiGate.refresh();
    } catch (err) {
      setAiExplanations((current) => ({
        ...current,
        [item.id]: { loading: false, error: err instanceof Error ? err.message : String(err) },
      }));
    }
  };

  const toggleSave = async (item: Exercise) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    setSavingId(item.id);
    const isSaved = savedIds.has(item.id);
    try {
      if (isSaved) {
        await supabase.from('saved_exercises').delete().eq('user_id', userId).eq('exercise_id', item.id);
        setSavedIds((s) => {
          const next = new Set(s);
          next.delete(item.id);
          return next;
        });
      } else {
        await supabase.from('saved_exercises').insert({ user_id: userId, exercise_id: item.id });
        setSavedIds((s) => new Set(s).add(item.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.usageRow}>
        <AiUsageIndicator
          isPremium={aiGate.isPremium}
          remaining={aiGate.remaining}
          loaded={aiGate.loaded}
        />
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
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text
              style={[styles.filterChipText, filter === f.value && styles.filterChipTextActive]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {muscleGroups.length > 0 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.muscleFilterRow}
          contentContainerStyle={styles.muscleFilterContent}
          data={muscleGroups}
          keyExtractor={(mg) => mg}
          renderItem={({ item: mg }) => (
            <Pressable
              style={[styles.muscleChip, muscleFilter === mg && styles.muscleChipActive]}
              onPress={() => setMuscleFilter(muscleFilter === mg ? null : mg)}
            >
              <Text style={[styles.muscleChipText, muscleFilter === mg && styles.muscleChipTextActive]}>
                {mg}
              </Text>
            </Pressable>
          )}
        />
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
            No exercises here yet. Add some in your Supabase dashboard's Table Editor.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={dark.accent} />}
          renderItem={({ item }) => {
            const expanded = expandedId === item.id;
            const saved = savedIds.has(item.id);
            return (
              <Pressable
                style={styles.card}
                onPress={() => setExpandedId(expanded ? null : item.id)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleSave(item);
                    }}
                    disabled={savingId === item.id}
                    hitSlop={8}
                  >
                    <Text style={styles.saveIcon}>{saved ? '★' : '☆'}</Text>
                  </Pressable>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.category}</Text>
                  </View>
                </View>

                {item.muscle_groups.length > 0 && (
                  <Text style={styles.metaLine}>
                    <Text style={styles.metaLabel}>Muscles: </Text>
                    {item.muscle_groups.join(', ')}
                  </Text>
                )}
                {item.equipment.length > 0 && (
                  <Text style={styles.metaLine}>
                    <Text style={styles.metaLabel}>Equipment: </Text>
                    {item.equipment.join(', ')}
                  </Text>
                )}

                {expanded && (
                  <View style={styles.details}>
                    {item.instructions ? (
                      <>
                        <Text style={styles.detailsLabel}>Instructions</Text>
                        <Text style={styles.detailsText}>{item.instructions}</Text>
                      </>
                    ) : null}
                    {item.benefits ? (
                      <>
                        <Text style={styles.detailsLabel}>Benefits</Text>
                        <Text style={styles.detailsText}>{item.benefits}</Text>
                      </>
                    ) : null}

                    <View style={styles.aiSection}>
                      {(() => {
                        const ai = aiExplanations[item.id];
                        if (!ai) {
                          return (
                            <Pressable
                              style={styles.aiButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                askAi(item);
                              }}
                            >
                              <Text style={styles.aiButtonText}>Ask AI: form, sets/reps & mistakes</Text>
                            </Pressable>
                          );
                        }
                        if (ai.loading) {
                          return (
                            <View style={styles.aiLoadingRow}>
                              <ActivityIndicator size="small" color={dark.accent} />
                              <Text style={styles.aiLoadingText}>Asking AI...</Text>
                            </View>
                          );
                        }
                        if (ai.error) {
                          return (
                            <>
                              <Text style={styles.aiError}>Couldn't get an AI explanation: {ai.error}</Text>
                              <Pressable
                                style={styles.aiButton}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  askAi(item);
                                }}
                              >
                                <Text style={styles.aiButtonText}>Try again</Text>
                              </Pressable>
                            </>
                          );
                        }
                        return (
                          <>
                            <Text style={styles.detailsLabel}>AI Explanation</Text>
                            <Text style={styles.detailsText}>{ai.text}</Text>
                          </>
                        );
                      })()}
                    </View>
                  </View>
                )}

                <Text style={styles.expandHint}>{expanded ? 'Tap to collapse' : 'Tap for details'}</Text>
              </Pressable>
            );
          }}
        />
      )}
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
  muscleFilterRow: {
    marginBottom: 12,
  },
  muscleFilterContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  muscleChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: dark.border,
  },
  muscleChipActive: {
    backgroundColor: dark.surfaceElevated,
    borderColor: dark.accent,
  },
  muscleChipText: {
    fontSize: 12,
    color: dark.textFaint,
    textTransform: 'capitalize',
  },
  muscleChipTextActive: {
    color: dark.accent,
    fontWeight: '600',
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
  card: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
    color: dark.text,
    flex: 1,
  },
  saveIcon: {
    fontSize: 20,
    color: dark.accent,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: dark.surfaceElevated,
  },
  badgeText: {
    color: dark.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaLine: {
    fontSize: 13,
    color: dark.textMuted,
    marginTop: 2,
  },
  metaLabel: {
    fontWeight: '600',
    color: dark.text,
  },
  details: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: dark.border,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: dark.text,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  detailsText: {
    fontSize: 14,
    color: dark.textMuted,
    marginTop: 2,
    lineHeight: 20,
  },
  aiSection: {
    marginTop: 12,
  },
  aiButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  aiButtonText: {
    color: '#0a0a0a',
    fontSize: 13,
    fontWeight: '700',
  },
  aiLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiLoadingText: {
    fontSize: 13,
    color: dark.textMuted,
  },
  aiError: {
    fontSize: 13,
    color: dark.danger,
    marginBottom: 8,
  },
  expandHint: {
    fontSize: 11,
    color: dark.textFaint,
    marginTop: 10,
  },
});
