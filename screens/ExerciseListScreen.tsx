import { useCallback, useEffect, useState } from 'react';
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
import { colors } from '../lib/theme';
import type { Exercise, ExerciseCategory } from '../lib/types';

type AiState = { loading: boolean; text?: string; error?: string };

const FILTERS: { label: string; value: ExerciseCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Home', value: 'home' },
  { label: 'Outdoor', value: 'outdoor' },
  { label: 'Gym', value: 'gym' },
];

const CATEGORY_COLORS: Record<ExerciseCategory, string> = {
  home: '#2563eb',
  outdoor: '#16a34a',
  gym: '#ea580c',
};

export default function ExerciseListScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filter, setFilter] = useState<ExerciseCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiExplanations, setAiExplanations] = useState<Record<string, AiState>>({});
  const aiGate = useAiGate();

  const fetchExercises = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('exercises')
      .select('*')
      .order('name', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setExercises(data ?? []);
    }
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

  const filtered = exercises
    .filter((e) => filter === 'all' || e.category === filter)
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

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const expanded = expandedId === item.id;
            return (
              <Pressable
                style={styles.card}
                onPress={() => setExpandedId(expanded ? null : item.id)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <View
                    style={[styles.badge, { backgroundColor: CATEGORY_COLORS[item.category] }]}
                  >
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
                              <Text style={styles.aiButtonText}>Ask AI to explain</Text>
                            </Pressable>
                          );
                        }
                        if (ai.loading) {
                          return (
                            <View style={styles.aiLoadingRow}>
                              <ActivityIndicator size="small" />
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
    backgroundColor: '#fff',
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
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#f1f1f1',
  },
  filterChipActive: {
    backgroundColor: '#111',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  error: {
    color: '#dc2626',
    textAlign: 'center',
  },
  empty: {
    color: '#888',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
    flexShrink: 1,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaLine: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
  },
  metaLabel: {
    fontWeight: '600',
    color: '#333',
  },
  details: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
    marginTop: 6,
    textTransform: 'uppercase',
  },
  detailsText: {
    fontSize: 14,
    color: '#444',
    marginTop: 2,
    lineHeight: 20,
  },
  aiSection: {
    marginTop: 12,
  },
  aiButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  aiButtonText: {
    color: '#fff',
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
    color: '#666',
  },
  aiError: {
    fontSize: 13,
    color: '#dc2626',
    marginBottom: 8,
  },
  expandHint: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 10,
  },
});
