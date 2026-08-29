import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { dark } from '../lib/theme';

type Region = { key: string; label: string; shape: 'rect' | 'circle'; x: number; y: number; w: number; h: number; rx?: number };

// A deliberately stylized, non-anatomical silhouette (blocky regions, not
// muscle fibers) -- a tappable filter surface, not a medical diagram.
// Shared regions (head/shoulders/arms/legs) appear in both views; chest
// swaps for back, biceps for triceps, quadriceps for hamstrings, and the
// back view adds glutes, matching how the human body actually differs
// front-to-back.
const FRONT_REGIONS: Region[] = [
  { key: 'shoulders', label: 'Shoulders', shape: 'circle', x: 38, y: 62, w: 20, h: 20 },
  { key: 'shoulders', label: 'Shoulders', shape: 'circle', x: 122, y: 62, w: 20, h: 20 },
  { key: 'chest', label: 'Chest', shape: 'rect', x: 55, y: 58, w: 50, h: 42, rx: 10 },
  { key: 'biceps', label: 'Biceps', shape: 'rect', x: 20, y: 75, w: 20, h: 55, rx: 8 },
  { key: 'biceps', label: 'Biceps', shape: 'rect', x: 120, y: 75, w: 20, h: 55, rx: 8 },
  { key: 'core', label: 'Core', shape: 'rect', x: 60, y: 102, w: 40, h: 48, rx: 8 },
  { key: 'quadriceps', label: 'Quadriceps', shape: 'rect', x: 55, y: 165, w: 22, h: 65, rx: 8 },
  { key: 'quadriceps', label: 'Quadriceps', shape: 'rect', x: 83, y: 165, w: 22, h: 65, rx: 8 },
];

const BACK_REGIONS: Region[] = [
  { key: 'shoulders', label: 'Shoulders', shape: 'circle', x: 38, y: 62, w: 20, h: 20 },
  { key: 'shoulders', label: 'Shoulders', shape: 'circle', x: 122, y: 62, w: 20, h: 20 },
  { key: 'back', label: 'Back', shape: 'rect', x: 55, y: 58, w: 50, h: 42, rx: 10 },
  { key: 'triceps', label: 'Triceps', shape: 'rect', x: 20, y: 75, w: 20, h: 55, rx: 8 },
  { key: 'triceps', label: 'Triceps', shape: 'rect', x: 120, y: 75, w: 20, h: 55, rx: 8 },
  { key: 'glutes', label: 'Glutes', shape: 'rect', x: 58, y: 102, w: 44, h: 30, rx: 10 },
  { key: 'hamstrings', label: 'Hamstrings', shape: 'rect', x: 55, y: 136, w: 22, h: 65, rx: 8 },
  { key: 'hamstrings', label: 'Hamstrings', shape: 'rect', x: 83, y: 136, w: 22, h: 65, rx: 8 },
];

function RegionShape({
  region,
  active,
  onPress,
}: {
  region: Region;
  active: boolean;
  onPress: () => void;
}) {
  const fill = active ? dark.accent : 'rgba(255,255,255,0.08)';
  const stroke = active ? dark.accent : 'rgba(255,255,255,0.2)';

  if (region.shape === 'circle') {
    return (
      <Circle
        cx={region.x + region.w / 2}
        cy={region.y + region.h / 2}
        r={region.w / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={1}
        onPress={onPress}
      />
    );
  }
  return (
    <Rect
      x={region.x}
      y={region.y}
      width={region.w}
      height={region.h}
      rx={region.rx ?? 6}
      fill={fill}
      stroke={stroke}
      strokeWidth={1}
      onPress={onPress}
    />
  );
}

export default function MuscleBodyMap({
  availableMuscles,
  selected,
  onSelect,
}: {
  availableMuscles: string[];
  selected: string | null;
  onSelect: (muscle: string | null) => void;
}) {
  const [view, setView] = useState<'front' | 'back'>('front');
  const regions = view === 'front' ? FRONT_REGIONS : BACK_REGIONS;
  const mappedKeys = new Set([...FRONT_REGIONS, ...BACK_REGIONS].map((r) => r.key));
  const unmappedMuscles = availableMuscles.filter((m) => !mappedKeys.has(m));

  const handleTap = (key: string) => {
    onSelect(selected === key ? null : key);
  };

  return (
    <View style={styles.card}>
      <View style={styles.toggleRow}>
        <Pressable style={[styles.toggle, view === 'front' && styles.toggleActive]} onPress={() => setView('front')}>
          <Text style={[styles.toggleText, view === 'front' && styles.toggleTextActive]}>Front</Text>
        </Pressable>
        <Pressable style={[styles.toggle, view === 'back' && styles.toggleActive]} onPress={() => setView('back')}>
          <Text style={[styles.toggleText, view === 'back' && styles.toggleTextActive]}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.svgWrap}>
        <Svg width={160} height={250} viewBox="0 0 160 250">
          <Circle cx={80} cy={30} r={18} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
          {regions.map((region, i) => (
            <RegionShape key={`${region.key}-${i}`} region={region} active={selected === region.key} onPress={() => handleTap(region.key)} />
          ))}
        </Svg>
      </View>

      <View style={styles.legendRow}>
        {[...new Set(regions.map((r) => r.key))].map((key) => {
          const label = regions.find((r) => r.key === key)?.label ?? key;
          const active = selected === key;
          return (
            <Pressable key={key} style={[styles.legendChip, active && styles.legendChipActive]} onPress={() => handleTap(key)}>
              <Text style={[styles.legendChipText, active && styles.legendChipTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {unmappedMuscles.length > 0 && (
        <View style={styles.legendRow}>
          {unmappedMuscles.map((m) => {
            const active = selected === m;
            return (
              <Pressable
                key={m}
                style={[styles.legendChip, active && styles.legendChipActive]}
                onPress={() => onSelect(selected === m ? null : m)}
              >
                <Text style={[styles.legendChipText, active && styles.legendChipTextActive]}>{m}</Text>
              </Pressable>
            );
          })}
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
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  toggle: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 16,
  },
  toggleActive: {
    borderColor: dark.accent,
    backgroundColor: dark.surfaceElevated,
  },
  toggleText: {
    color: dark.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: dark.accent,
  },
  svgWrap: {
    marginBottom: 10,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  legendChip: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  legendChipActive: {
    borderColor: dark.accent,
    backgroundColor: dark.surfaceElevated,
  },
  legendChipText: {
    color: dark.textFaint,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  legendChipTextActive: {
    color: dark.accent,
  },
});
