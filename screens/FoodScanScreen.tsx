import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import PhotoScanScreen from '../components/PhotoScanScreen';
import { FOOD_SCAN_PROMPT } from '../lib/claude';
import { addMeal, todayLocalDate } from '../lib/nutrition';
import { dark } from '../lib/theme';
import type { MealType } from '../lib/types';

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

function AddToMealsForm({ aiResult }: { aiResult: string }) {
  const [open, setOpen] = useState(false);
  const [mealType, setMealType] = useState<MealType>('snack');
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await addMeal({
        logDate: todayLocalDate(),
        mealType,
        description: description.trim() || 'Scanned food',
        calories: Number(calories) || 0,
        proteinG: Number(protein) || 0,
        carbsG: Number(carbs) || 0,
        fatG: Number(fat) || 0,
        source: 'scan',
      });
      setSaved(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return <Text style={styles.savedText}>✓ Added to today's meals</Text>;
  }

  if (!open) {
    return (
      <Pressable style={styles.addButton} onPress={() => setOpen(true)}>
        <Text style={styles.addButtonText}>+ Add to Today's Meals</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.formHint}>
        Enter the numbers based on the estimate above — correct them if you know better.
      </Text>
      <View style={styles.mealTypeRow}>
        {MEAL_TYPES.map((m) => (
          <Pressable
            key={m.value}
            style={[styles.mealTypeChip, mealType === m.value && styles.mealTypeChipActive]}
            onPress={() => setMealType(m.value)}
          >
            <Text style={[styles.mealTypeChipText, mealType === m.value && styles.mealTypeChipTextActive]}>
              {m.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Description (e.g. Chicken & rice bowl)"
        placeholderTextColor={dark.textFaint}
        value={description}
        onChangeText={setDescription}
      />
      <View style={styles.macroRow}>
        <TextInput
          style={[styles.input, styles.macroInput]}
          placeholder="Calories"
          placeholderTextColor={dark.textFaint}
          value={calories}
          onChangeText={setCalories}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.input, styles.macroInput]}
          placeholder="Protein (g)"
          placeholderTextColor={dark.textFaint}
          value={protein}
          onChangeText={setProtein}
          keyboardType="numeric"
        />
      </View>
      <View style={styles.macroRow}>
        <TextInput
          style={[styles.input, styles.macroInput]}
          placeholder="Carbs (g)"
          placeholderTextColor={dark.textFaint}
          value={carbs}
          onChangeText={setCarbs}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.input, styles.macroInput]}
          placeholder="Fat (g)"
          placeholderTextColor={dark.textFaint}
          value={fat}
          onChangeText={setFat}
          keyboardType="numeric"
        />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.saveButtonText}>Save</Text>}
      </Pressable>
    </View>
  );
}

export default function FoodScanScreen({ onBack }: { onBack?: () => void }) {
  return (
    <PhotoScanScreen
      title="Scan Food"
      subtitle="Take or choose a photo of a meal or snack to get an estimated calorie and macro breakdown."
      prompt={FOOD_SCAN_PROMPT}
      loadingLabel="Analyzing food..."
      historyKind="food_scan"
      backLabel="Nutrition"
      onBack={onBack}
      renderAfterResult={(result) => <AddToMealsForm aiResult={result} />}
    />
  );
}

const styles = StyleSheet.create({
  addButton: {
    marginTop: 12,
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
  savedText: {
    marginTop: 12,
    color: dark.accent,
    fontWeight: '700',
    textAlign: 'center',
  },
  form: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 12,
    padding: 14,
  },
  formHint: {
    color: dark.textFaint,
    fontSize: 12,
    marginBottom: 10,
  },
  mealTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  mealTypeChip: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  mealTypeChipActive: {
    backgroundColor: dark.accent,
    borderColor: dark.accent,
  },
  mealTypeChipText: {
    color: dark.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  mealTypeChipTextActive: {
    color: '#0a0a0a',
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
    marginBottom: 10,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10,
  },
  macroInput: {
    flex: 1,
  },
  error: {
    color: dark.danger,
    marginBottom: 10,
    fontSize: 12,
  },
  saveButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
});
