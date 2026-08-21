import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { submitTrainerProfile } from '../lib/trainerDashboard';
import { dark } from '../lib/theme';
import type { TrainerProfile } from '../lib/types';

const SPECIALTIES = ['Online', 'Local', 'Strength', 'Weight Loss', "Women's Fitness", 'Bodybuilding', 'Running'];

export default function TrainerProfileForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing: TrainerProfile | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [displayName, setDisplayName] = useState(existing?.display_name ?? '');
  const [specialty, setSpecialty] = useState(existing?.specialty ?? '');
  const [bio, setBio] = useState(existing?.bio ?? '');
  const [price, setPrice] = useState(existing ? String(existing.price_cents / 100) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const priceCents = Math.round(Number(price) * 100);

    if (!displayName.trim()) {
      setError('Enter a display name.');
      return;
    }
    if (!price || !Number.isFinite(priceCents) || priceCents < 100) {
      setError('Enter a price of at least $1.');
      return;
    }

    setSaving(true);
    try {
      await submitTrainerProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        specialty: specialty.trim(),
        priceCents,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Display Name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Your name"
        placeholderTextColor={dark.textFaint}
      />

      <Text style={styles.label}>Specialty</Text>
      <View style={styles.chipRow}>
        {SPECIALTIES.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, specialty === s && styles.chipActive]}
            onPress={() => setSpecialty(s)}
          >
            <Text style={[styles.chipText, specialty === s && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={specialty}
        onChangeText={setSpecialty}
        placeholder="Or type your own specialty"
        placeholderTextColor={dark.textFaint}
      />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={bio}
        onChangeText={setBio}
        placeholder="Tell clients about your experience and approach"
        placeholderTextColor={dark.textFaint}
        multiline
      />

      <Text style={styles.label}>Price per Custom Plan (USD)</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        placeholder="49"
        placeholderTextColor={dark.textFaint}
        keyboardType="decimal-pad"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.buttonRow}>
        {onCancel && (
          <Pressable style={styles.cancelButton} onPress={onCancel} disabled={saving}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        )}
        <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#0a0a0a" />
          ) : (
            <Text style={styles.submitButtonText}>
              {existing ? 'Save Changes' : 'Become a Trainer'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 16,
    padding: 16,
  },
  label: {
    fontSize: 12,
    color: dark.textMuted,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surfaceElevated,
    color: dark.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  bioInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: dark.accent,
    borderColor: dark.accent,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: dark.textMuted,
  },
  chipTextActive: {
    color: '#0a0a0a',
  },
  error: {
    color: dark.danger,
    marginTop: 12,
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: dark.textMuted,
    fontWeight: '700',
  },
  submitButton: {
    flex: 2,
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
});
