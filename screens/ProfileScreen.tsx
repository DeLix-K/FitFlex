import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { computeTargets, deleteAccount, fetchBodyStats, updateBodyStats } from '../lib/profile';
import { colors } from '../lib/theme';
import type { ActivityLevel, BodyStats, Goal, Sex } from '../lib/types';

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very Active' },
];

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'lose', label: 'Lose Weight' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain Weight' },
];

export default function ProfileScreen() {
  const [stats, setStats] = useState<BodyStats>({
    height_cm: null,
    weight_kg: null,
    age: null,
    sex: null,
    activity_level: null,
    goal: null,
  });
  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [ageInput, setAgeInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchBodyStats();
      if (data) {
        setStats(data);
        setHeightInput(data.height_cm != null ? String(data.height_cm) : '');
        setWeightInput(data.weight_kg != null ? String(data.weight_kg) : '');
        setAgeInput(data.age != null ? String(data.age) : '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleSave = async () => {
    setError(null);
    setSaved(false);

    const height_cm = heightInput ? Number(heightInput) : null;
    const weight_kg = weightInput ? Number(weightInput) : null;
    const age = ageInput ? Number(ageInput) : null;

    if (heightInput && (Number.isNaN(height_cm) || height_cm! <= 0)) {
      setError('Enter a valid height in cm.');
      return;
    }
    if (weightInput && (Number.isNaN(weight_kg) || weight_kg! <= 0)) {
      setError('Enter a valid weight in kg.');
      return;
    }
    if (ageInput && (Number.isNaN(age) || age! <= 0)) {
      setError('Enter a valid age.');
      return;
    }

    const nextStats: BodyStats = { ...stats, height_cm, weight_kg, age };
    setSaving(true);
    try {
      await updateBodyStats(nextStats);
      setStats(nextStats);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const setSex = async (sex: Sex) => {
    const nextStats = { ...stats, sex };
    setStats(nextStats);
    try {
      await updateBodyStats(nextStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const setActivityLevel = async (activity_level: ActivityLevel) => {
    const nextStats = { ...stats, activity_level };
    setStats(nextStats);
    try {
      await updateBodyStats(nextStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const setGoal = async (goal: Goal) => {
    const nextStats = { ...stats, goal };
    setStats(nextStats);
    try {
      await updateBodyStats(nextStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const targets = computeTargets(stats);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>
        Add your body stats to get personalized daily calorie and protein targets.
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.form}>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              value={heightInput}
              onChangeText={setHeightInput}
              keyboardType="decimal-pad"
              placeholder="175"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder="70"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              value={ageInput}
              onChangeText={setAgeInput}
              keyboardType="number-pad"
              placeholder="30"
            />
          </View>
        </View>

        <Text style={styles.label}>Sex</Text>
        <View style={styles.chipRow}>
          {(['male', 'female'] as Sex[]).map((s) => (
            <Pressable
              key={s}
              style={[styles.chip, stats.sex === s && styles.chipSelected]}
              onPress={() => setSex(s)}
            >
              <Text style={[styles.chipText, stats.sex === s && styles.chipTextSelected]}>
                {s === 'male' ? 'Male' : 'Female'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Activity Level</Text>
        <View style={styles.chipRow}>
          {ACTIVITY_OPTIONS.map((o) => (
            <Pressable
              key={o.value}
              style={[styles.chip, stats.activity_level === o.value && styles.chipSelected]}
              onPress={() => setActivityLevel(o.value)}
            >
              <Text
                style={[styles.chipText, stats.activity_level === o.value && styles.chipTextSelected]}
              >
                {o.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Goal</Text>
        <View style={styles.chipRow}>
          {GOAL_OPTIONS.map((o) => (
            <Pressable
              key={o.value}
              style={[styles.chip, stats.goal === o.value && styles.chipSelected]}
              onPress={() => setGoal(o.value)}
            >
              <Text style={[styles.chipText, stats.goal === o.value && styles.chipTextSelected]}>
                {o.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>{saved ? 'Saved ✓' : 'Save'}</Text>
          )}
        </Pressable>
      </View>

      {targets && (
        <View style={styles.targetsCard}>
          <Text style={styles.targetsTitle}>Your Daily Targets</Text>
          <View style={styles.targetsRow}>
            <View style={styles.targetBox}>
              <Text style={styles.targetValue}>{targets.calories}</Text>
              <Text style={styles.targetLabel}>calories</Text>
            </View>
            <View style={styles.targetBox}>
              <Text style={styles.targetValue}>{targets.proteinGrams}g</Text>
              <Text style={styles.targetLabel}>protein</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.dangerZone}>
        <Text style={styles.dangerTitle}>Danger Zone</Text>
        <Text style={styles.dangerText}>
          Deleting your account permanently removes your profile, plans, history, streaks, and
          all other data. This cannot be undone.
        </Text>

        {confirmingDelete ? (
          <View style={styles.confirmRow}>
            <Pressable
              style={styles.deleteConfirmButton}
              onPress={handleDeleteAccount}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.deleteConfirmButtonText}>Yes, delete my account</Text>
              )}
            </Pressable>
            <Pressable onPress={() => setConfirmingDelete(false)} disabled={deleting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.deleteButton} onPress={() => setConfirmingDelete(true)}>
            <Text style={styles.deleteButtonText}>Delete My Account</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
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
    color: colors.textFaint,
    marginTop: 4,
    marginBottom: 16,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
  },
  form: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  field: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  chipTextSelected: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  targetsCard: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  targetsTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  targetsRow: {
    flexDirection: 'row',
    gap: 24,
  },
  targetBox: {},
  targetValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  targetLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  dangerZone: {
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: 6,
  },
  dangerText: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 17,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  confirmRow: {
    gap: 10,
  },
  deleteConfirmButton: {
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  deleteConfirmButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  cancelText: {
    color: colors.textMuted,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 13,
  },
});
