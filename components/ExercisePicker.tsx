import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import type { Exercise } from '../lib/types';

export default function ExercisePicker({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
}) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    supabase
      .from('exercises')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message);
        else setExercises(data ?? []);
        setLoading(false);
      });
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add an Exercise</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : exercises.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.empty}>No exercises available yet.</Text>
          </View>
        ) : (
          <FlatList
            data={exercises}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => onSelect(item)}>
                <View>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowCategory}>{item.category}</Text>
                </View>
                <Text style={styles.add}>Add</Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  close: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowCategory: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  add: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
});
