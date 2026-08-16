import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchHistory } from '../lib/aiHistory';
import type { AiHistoryEntry, AiHistoryKind } from '../lib/types';

const FILTERS: { label: string; value: AiHistoryKind | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Coach', value: 'coach_chat' },
  { label: 'Wellness', value: 'mood_reflection' },
  { label: 'Exercises', value: 'exercise_explanation' },
  { label: 'Equipment', value: 'equipment_scan' },
  { label: 'Food', value: 'food_scan' },
  { label: 'Nutrition', value: 'nutrition_search' },
];

const KIND_LABELS: Record<AiHistoryKind, string> = {
  coach_chat: 'AI Coach',
  mood_reflection: 'Wellness',
  exercise_explanation: 'Exercise Explanation',
  equipment_scan: 'Equipment Scan',
  food_scan: 'Food Scan',
  nutrition_search: 'Nutrition Search',
};

const KIND_COLORS: Record<AiHistoryKind, string> = {
  coach_chat: '#0891b2',
  mood_reflection: '#db2777',
  exercise_explanation: '#7c3aed',
  equipment_scan: '#2563eb',
  food_scan: '#16a34a',
  nutrition_search: '#ea580c',
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' at ' +
    date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function HistoryScreen() {
  const [entries, setEntries] = useState<AiHistoryEntry[]>([]);
  const [filter, setFilter] = useState<AiHistoryKind | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEntries(await fetchHistory());
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

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.kind === filter);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>History</Text>

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
            No history yet. Results from scans and nutrition searches will show up here.
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
                  <View
                    style={[styles.badge, { backgroundColor: KIND_COLORS[item.kind] }]}
                  >
                    <Text style={styles.badgeText}>{KIND_LABELS[item.kind]}</Text>
                  </View>
                  <Text style={styles.date}>{formatDate(item.created_at)}</Text>
                </View>

                {item.query && <Text style={styles.query}>"{item.query}"</Text>}

                <Text style={styles.resultText} numberOfLines={expanded ? undefined : 2}>
                  {item.result}
                </Text>

                <Text style={styles.expandHint}>{expanded ? 'Tap to collapse' : 'Tap to expand'}</Text>
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
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 12,
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
    marginBottom: 8,
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
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
  query: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#555',
    marginBottom: 6,
  },
  resultText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  expandHint: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 8,
  },
});
