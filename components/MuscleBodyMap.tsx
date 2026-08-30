import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';

// Source renders are 340x495 (front) / 340x485 (back) -- hit-regions below
// are hand-calibrated against those exact pixel dimensions, then scaled to
// whatever DISPLAY_WIDTH the map renders at. The artwork itself is a single
// flat image with every muscle already rendered green, so "selecting" a
// muscle can't recolor the pixel art directly (there's no per-muscle mask) --
// instead a translucent ring is drawn over the tapped region, and the
// matching label chip below highlights, same as the reference mockup shows
// happening to the active chip.
const DISPLAY_WIDTH = 230;
const FRONT_SRC = { w: 340, h: 495 };
const BACK_SRC = { w: 340, h: 485 };

type Region = { key: string; x: number; y: number; w: number; h: number; round?: boolean };

const FRONT_REGIONS: Region[] = [
  { key: 'shoulders', x: 50, y: 76, w: 58, h: 62, round: true },
  { key: 'shoulders', x: 232, y: 76, w: 58, h: 62, round: true },
  { key: 'chest', x: 103, y: 78, w: 134, h: 72 },
  { key: 'biceps', x: 30, y: 140, w: 58, h: 92 },
  { key: 'biceps', x: 252, y: 140, w: 58, h: 92 },
  { key: 'core', x: 113, y: 152, w: 114, h: 105 },
  { key: 'quadriceps', x: 100, y: 262, w: 64, h: 150 },
  { key: 'quadriceps', x: 176, y: 262, w: 64, h: 150 },
];

const BACK_REGIONS: Region[] = [
  { key: 'shoulders', x: 50, y: 70, w: 58, h: 62, round: true },
  { key: 'shoulders', x: 232, y: 70, w: 58, h: 62, round: true },
  { key: 'back', x: 103, y: 70, w: 134, h: 112 },
  { key: 'triceps', x: 30, y: 133, w: 58, h: 92 },
  { key: 'triceps', x: 252, y: 133, w: 58, h: 92 },
  { key: 'glutes', x: 113, y: 188, w: 114, h: 68 },
  { key: 'hamstrings', x: 100, y: 256, w: 64, h: 150 },
  { key: 'hamstrings', x: 176, y: 256, w: 64, h: 150 },
];

const REGION_LABEL: Record<string, string> = {
  shoulders: 'Shoulders',
  chest: 'Chest',
  biceps: 'Biceps',
  core: 'Core',
  quadriceps: 'Quadriceps',
  back: 'Back',
  triceps: 'Triceps',
  glutes: 'Glutes',
  hamstrings: 'Hamstrings',
};

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
  const src = view === 'front' ? FRONT_SRC : BACK_SRC;
  const regions = view === 'front' ? FRONT_REGIONS : BACK_REGIONS;
  const scale = DISPLAY_WIDTH / src.w;
  const displayHeight = src.h * scale;

  const mappedKeys = new Set([...FRONT_REGIONS, ...BACK_REGIONS].map((r) => r.key));
  const unmappedMuscles = availableMuscles.filter((m) => !mappedKeys.has(m));

  const handleTap = (key: string) => onSelect(selected === key ? null : key);

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

      <View style={[styles.imageWrap, { width: DISPLAY_WIDTH, height: displayHeight }]}>
        <Image
          source={view === 'front' ? require('../assets/exercises/body_front.png') : require('../assets/exercises/body_back.png')}
          style={{ width: DISPLAY_WIDTH, height: displayHeight }}
          resizeMode="contain"
        />
        {regions.map((region, i) => {
          const active = selected === region.key;
          return (
            <Pressable
              key={`${region.key}-${i}`}
              onPress={() => handleTap(region.key)}
              style={[
                styles.hitRegion,
                {
                  left: region.x * scale,
                  top: region.y * scale,
                  width: region.w * scale,
                  height: region.h * scale,
                  borderRadius: region.round ? (region.w * scale) / 2 : 10,
                },
                active && styles.hitRegionActive,
              ]}
            />
          );
        })}
      </View>

      <Text style={styles.hint}>💡 Tap a muscle group to filter the exercises below.</Text>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: dark.accent }]} />
          <Text style={styles.legendText}>Selected Muscle</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: dark.border }]} />
          <Text style={styles.legendText}>Other Muscles</Text>
        </View>
      </View>

      <View style={styles.chipsRow}>
        {[...new Set(regions.map((r) => r.key))].map((key) => {
          const active = selected === key;
          return (
            <Pressable key={key} style={[styles.chip, active && styles.chipActive]} onPress={() => handleTap(key)}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{REGION_LABEL[key]}</Text>
            </Pressable>
          );
        })}
      </View>

      {unmappedMuscles.length > 0 && (
        <View style={styles.chipsRow}>
          {unmappedMuscles.map((m) => {
            const active = selected === m;
            return (
              <Pressable key={m} style={[styles.chip, active && styles.chipActive]} onPress={() => onSelect(selected === m ? null : m)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{m}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={styles.scrollHint}>↓ Scroll down for exercises</Text>
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
    marginBottom: 12,
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
  imageWrap: {
    marginBottom: 14,
    position: 'relative',
  },
  hitRegion: {
    position: 'absolute',
    borderWidth: 0,
  },
  hitRegionActive: {
    borderWidth: 2,
    borderColor: dark.accent,
    backgroundColor: 'rgba(163, 230, 53, 0.18)',
  },
  hint: {
    color: dark.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  legendText: {
    color: dark.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  chip: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  chipActive: {
    borderColor: dark.accent,
    backgroundColor: dark.surfaceElevated,
  },
  chipText: {
    color: dark.textFaint,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: dark.accent,
  },
  scrollHint: {
    color: dark.textFaint,
    fontSize: 11,
    marginTop: 12,
  },
});
