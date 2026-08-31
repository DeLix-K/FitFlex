import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Exercise, WorkoutPlanExercise } from '../lib/types';
import { startCheckout } from '../lib/billing';
import { smartSwapEquipment } from '../lib/plans';
import { dark } from '../lib/theme';

const TARGETS: { key: string; label: string }[] = [
  { key: 'dumbbell', label: 'Dumbbell' },
  { key: 'barbell', label: 'Barbell' },
  { key: 'bodyweight', label: 'Bodyweight' },
  { key: 'cable machine', label: 'Cable Machine' },
  { key: 'machine', label: 'Machine' },
];

export default function SmartSwapModal({
  visible,
  onClose,
  items,
  allExercises,
  isPremium,
  onApplied,
}: {
  visible: boolean;
  onClose: () => void;
  items: WorkoutPlanExercise[];
  allExercises: Exercise[];
  isPremium: boolean;
  onApplied: () => void;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [result, setResult] = useState<{ swapped: { from: string; to: string }[]; unchanged: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTarget(null);
    setResult(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const apply = async () => {
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      const outcome = await smartSwapEquipment(items, target, allExercises);
      setResult(outcome);
      if (outcome.swapped.length > 0) onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await startCheckout();
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Smart Swap All</Text>
            <Pressable onPress={handleClose}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          <ScrollView>
            {!isPremium ? (
              <>
                <Text style={styles.subtitle}>
                  Swap every exercise in this plan to use one equipment type, where a real substitute exists in the
                  catalog. Exercises that already match, or have no substitute, are left as-is.
                </Text>
                <View style={styles.chipRow}>
                  {TARGETS.map((t) => (
                    <View key={t.key} style={styles.chip}>
                      <Text style={styles.chipText}>🔒 {t.label}</Text>
                    </View>
                  ))}
                </View>
                <Pressable style={styles.submitButton} onPress={handleUpgrade} disabled={upgrading}>
                  {upgrading ? (
                    <ActivityIndicator color="#0a0a0a" />
                  ) : (
                    <Text style={styles.submitButtonText}>🔒 Unlock with Premium</Text>
                  )}
                </Pressable>
              </>
            ) : !result ? (
              <>
                <Text style={styles.subtitle}>
                  Swap every exercise in this plan to use one equipment type, where a real substitute exists in the
                  catalog. Exercises that already match, or have no substitute, are left as-is.
                </Text>
                <View style={styles.chipRow}>
                  {TARGETS.map((t) => (
                    <Pressable
                      key={t.key}
                      style={[styles.chip, target === t.key && styles.chipActive]}
                      onPress={() => setTarget(t.key)}
                    >
                      <Text style={[styles.chipText, target === t.key && styles.chipTextActive]}>{t.label}</Text>
                    </Pressable>
                  ))}
                </View>

                {error && <Text style={styles.error}>{error}</Text>}

                <Pressable style={styles.submitButton} onPress={apply} disabled={!target || loading}>
                  {loading ? (
                    <ActivityIndicator color="#0a0a0a" />
                  ) : (
                    <Text style={styles.submitButtonText}>Swap All to {target ? TARGETS.find((t) => t.key === target)?.label : '...'}</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                {result.swapped.length > 0 ? (
                  <View style={styles.resultBox}>
                    <Text style={styles.resultTitle}>Swapped {result.swapped.length} exercise{result.swapped.length === 1 ? '' : 's'}</Text>
                    {result.swapped.map((s, i) => (
                      <Text key={i} style={styles.resultLine}>
                        {s.from} → {s.to}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.resultLine}>Nothing needed swapping.</Text>
                )}
                {result.unchanged.length > 0 && (
                  <View style={styles.resultBox}>
                    <Text style={styles.resultTitle}>Left unchanged (no substitute found)</Text>
                    {result.unchanged.map((name, i) => (
                      <Text key={i} style={styles.resultLine}>
                        {name}
                      </Text>
                    ))}
                  </View>
                )}
                <Pressable style={styles.submitButton} onPress={handleClose}>
                  <Text style={styles.submitButtonText}>Done</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: dark.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: dark.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: dark.text,
    fontSize: 17,
    fontWeight: '700',
  },
  close: {
    color: dark.accent,
    fontWeight: '600',
  },
  subtitle: {
    color: dark.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActive: {
    backgroundColor: dark.accent,
    borderColor: dark.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: dark.textMuted,
  },
  chipTextActive: {
    color: '#0a0a0a',
  },
  error: {
    color: dark.danger,
    marginTop: 14,
    fontSize: 12,
  },
  submitButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  submitButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
  resultBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 12,
    padding: 16,
  },
  resultTitle: {
    color: dark.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  resultLine: {
    color: dark.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
});
