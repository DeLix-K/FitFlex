import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import type { Exercise } from '../lib/types';

export default function ManageVideosScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const draftRef = useRef<Record<string, string>>({});

  const fetchExercises = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('exercises')
      .select('*')
      .order('name', { ascending: true });

    if (fetchError) setError(fetchError.message);
    else setExercises(data ?? []);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchExercises().finally(() => setLoading(false));
  }, [fetchExercises]);

  const saveVideoUrl = async (itemId: string) => {
    const value = draftRef.current[itemId];
    if (value === undefined) return;

    setError(null);
    setExercises((current) =>
      current.map((e) => (e.id === itemId ? { ...e, video_url: value } : e))
    );

    const { error: updateError } = await supabase
      .from('exercises')
      .update({ video_url: value })
      .eq('id', itemId);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSavedId(itemId);
    setTimeout(() => setSavedId((current) => (current === itemId ? null : current)), 1500);
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
      <Text style={styles.title}>Manage Videos</Text>
      <Text style={styles.subtitle}>
        Paste a video link for any exercise. Leave blank to add it later.
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.exerciseName}>{item.name}</Text>
              {savedId === item.id && <Text style={styles.saved}>Saved</Text>}
            </View>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              autoCapitalize="none"
              autoCorrect={false}
              defaultValue={item.video_url ?? ''}
              onChangeText={(text) => {
                draftRef.current[item.id] = text;
              }}
              onBlur={() => saveVideoUrl(item.id)}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    marginBottom: 16,
  },
  error: {
    color: '#dc2626',
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 40,
  },
  row: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
  },
  saved: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 14,
  },
});
