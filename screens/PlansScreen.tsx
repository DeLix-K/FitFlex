import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import type { WorkoutPlan } from '../lib/types';
import PlanDetailScreen from './PlanDetailScreen';

type PlansView = { mode: 'list' } | { mode: 'new' } | { mode: 'detail'; planId: string };

export default function PlansScreen({ session }: { session: Session }) {
  const [view, setView] = useState<PlansView>({ mode: 'list' });
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchPlans = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('workout_plans')
      .select('*')
      .order('updated_at', { ascending: false });

    if (fetchError) setError(fetchError.message);
    else setPlans(data ?? []);
  }, []);

  useEffect(() => {
    if (view.mode !== 'list') return;
    setLoading(true);
    fetchPlans().finally(() => setLoading(false));
  }, [view.mode, fetchPlans]);

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
          value={newName}
          onChangeText={setNewName}
        />
        <TextInput
          style={styles.input}
          placeholder="Description (optional)"
          value={newDescription}
          onChangeText={setNewDescription}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.createButton} onPress={createPlan} disabled={creating}>
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>Create Plan</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>My Plans</Text>
        <Pressable onPress={() => setView({ mode: 'new' })}>
          <Text style={styles.newPlan}>+ New Plan</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorCentered}>{error}</Text>
        </View>
      ) : plans.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>
            You haven't created any workout plans yet. Tap "+ New Plan" to build one.
          </Text>
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: 22,
    fontWeight: '700',
  },
  newPlan: {
    color: colors.primary,
    fontWeight: '600',
  },
  back: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  empty: {
    color: '#888',
    textAlign: 'center',
  },
  errorCentered: {
    color: '#dc2626',
    textAlign: 'center',
  },
  error: {
    color: '#dc2626',
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 40,
  },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    fontSize: 16,
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
