import { useEffect, useMemo, useState } from 'react';
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
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    setSearch('');
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((e) => e.name.toLowerCase().includes(q));
  }, [exercises, search]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add an Exercise</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.search}
          placeholder="Search exercises..."
          placeholderTextColor={dark.textFaint}
          value={search}
          onChangeText={setSearch}
        />

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
            <Text style={styles.empty}>No exercises found.</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => onSelect(item)}>
                <View style={styles.rowTextWrap}>
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
    backgroundColor: dark.background,
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
    color: dark.text,
  },
  close: {
    color: dark.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  search: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    color: dark.text,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
  },
  rowTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
    color: dark.text,
  },
  rowCategory: {
    fontSize: 12,
    color: dark.textFaint,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  add: {
    color: dark.accent,
    fontWeight: '700',
    fontSize: 14,
  },
});
