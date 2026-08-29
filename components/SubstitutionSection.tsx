import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { findAntagonistCombo, findSubstitutes } from '../lib/exercises';
import { dark } from '../lib/theme';
import type { Exercise } from '../lib/types';

export default function SubstitutionSection({
  exercise,
  allExercises,
  onSelect,
}: {
  exercise: Exercise;
  allExercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
}) {
  const [equipmentFilter, setEquipmentFilter] = useState<string | null>(null);
  const [lowImpactOnly, setLowImpactOnly] = useState(false);

  const equipmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of allExercises) for (const eq of e.equipment) set.add(eq);
    return ['bodyweight', ...[...set].sort()];
  }, [allExercises]);

  const substitutes = findSubstitutes(exercise, allExercises, {
    equipment: equipmentFilter,
    lowImpactOnly,
  });

  const combo = findAntagonistCombo(exercise, allExercises);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🔄 Swap Exercise</Text>
      <Text style={styles.hint}>Same primary muscle, different equipment — real catalog matches only.</Text>

      <View style={styles.chipsRow}>
        <Pressable
          style={[styles.chip, equipmentFilter === null && styles.chipActive]}
          onPress={() => setEquipmentFilter(null)}
        >
          <Text style={[styles.chipText, equipmentFilter === null && styles.chipTextActive]}>Any Equipment</Text>
        </Pressable>
        {equipmentOptions.map((eq) => (
          <Pressable
            key={eq}
            style={[styles.chip, equipmentFilter === eq && styles.chipActive]}
            onPress={() => setEquipmentFilter(equipmentFilter === eq ? null : eq)}
          >
            <Text style={[styles.chipText, equipmentFilter === eq && styles.chipTextActive]}>{eq}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.chip, lowImpactOnly && styles.chipActive]}
          onPress={() => setLowImpactOnly((v) => !v)}
        >
          <Text style={[styles.chipText, lowImpactOnly && styles.chipTextActive]}>🦵 Joint-Friendly Only</Text>
        </Pressable>
      </View>

      {substitutes.length === 0 ? (
        <Text style={styles.emptyText}>No matching substitute in the catalog yet for that filter.</Text>
      ) : (
        substitutes.map((s) => (
          <Pressable key={s.id} style={styles.subRow} onPress={() => onSelect(s)}>
            <Text style={styles.subName}>{s.name}</Text>
            <Text style={styles.subEquip}>{s.equipment.length > 0 ? s.equipment.join(', ') : 'Bodyweight'}</Text>
          </Pressable>
        ))
      )}

      {combo && (
        <View style={styles.comboBox}>
          <Text style={styles.comboLabel}>💪 Commonly Paired Superset</Text>
          <Pressable onPress={() => onSelect(combo)}>
            <Text style={styles.comboText}>
              {exercise.name} ➔ {combo.name}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  title: {
    color: dark.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  hint: {
    color: dark.textFaint,
    fontSize: 11,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  chipActive: {
    borderColor: dark.accent,
    backgroundColor: dark.surfaceElevated,
  },
  chipText: {
    color: dark.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: dark.accent,
  },
  emptyText: {
    color: dark.textMuted,
    fontSize: 12,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: dark.border,
    paddingVertical: 10,
  },
  subName: {
    color: dark.text,
    fontSize: 13,
    fontWeight: '600',
  },
  subEquip: {
    color: dark.textFaint,
    fontSize: 11,
    textTransform: 'capitalize',
  },
  comboBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: dark.border,
  },
  comboLabel: {
    color: dark.textFaint,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  comboText: {
    color: dark.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
