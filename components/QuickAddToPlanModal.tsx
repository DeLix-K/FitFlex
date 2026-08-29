import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { addExerciseToPlan, fetchMyPlans, type PlanOption } from '../lib/exercises';
import { dark } from '../lib/theme';

export default function QuickAddToPlanModal({
  visible,
  exerciseId,
  exerciseName,
  onClose,
}: {
  visible: boolean;
  exerciseId: string | null;
  exerciseName: string;
  onClose: () => void;
}) {
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setAddedId(null);
    setError(null);
    setLoading(true);
    fetchMyPlans()
      .then(setPlans)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [visible]);

  const handleAdd = async (planId: string) => {
    if (!exerciseId) return;
    setAddingId(planId);
    setError(null);
    try {
      await addExerciseToPlan(planId, exerciseId);
      setAddedId(planId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Add "{exerciseName}" to a plan</Text>

          {loading ? (
            <ActivityIndicator color={dark.accent} style={{ marginVertical: 16 }} />
          ) : plans.length === 0 ? (
            <Text style={styles.empty}>You don't have any plans yet — create one in the Plans tab first.</Text>
          ) : (
            plans.map((plan) => {
              const added = addedId === plan.id;
              return (
                <Pressable
                  key={plan.id}
                  style={[styles.planRow, added && styles.planRowAdded]}
                  onPress={() => handleAdd(plan.id)}
                  disabled={addingId === plan.id || added}
                >
                  <Text style={styles.planName}>{plan.name}</Text>
                  {addingId === plan.id ? (
                    <ActivityIndicator size="small" color={dark.accent} />
                  ) : (
                    <Text style={added ? styles.addedText : styles.addText}>{added ? '✓ Added' : '+ Add'}</Text>
                  )}
                </Pressable>
              );
            })
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: dark.background,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    color: dark.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
  },
  empty: {
    color: dark.textMuted,
    fontSize: 13,
    marginBottom: 14,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  planRowAdded: {
    borderColor: dark.accent,
  },
  planName: {
    color: dark.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  addText: {
    color: dark.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  addedText: {
    color: dark.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  error: {
    color: dark.danger,
    fontSize: 12,
    marginTop: 8,
  },
  closeButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: dark.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
});
