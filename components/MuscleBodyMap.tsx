import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';

// Source renders are 340x495 (front) / 340x485 (back) -- hit-regions below
// are calibrated by actually analyzing the pixel art (scripted green-pixel
// blob detection for chest/core/biceps/quadriceps/back/hamstrings, which are
// pre-tinted green in the source image; silhouette/brightness edge-detection
// for shoulders/triceps, which the source art leaves untinted gray but are
// still real, visible anatomy), not eyeballed guesses -- see the coordinates
// verified against the actual images before this fix. Scaled to whatever
// DISPLAY_WIDTH the map renders at. The artwork itself is a single flat
// image with every trainable muscle already rendered green, so "selecting"
// a muscle can't recolor the pixel art directly (there's no per-muscle
// mask) -- instead a translucent ring is drawn over the tapped region, and
// the matching label chip below highlights, same as the reference mockup
// shows happening to the active chip.
const DISPLAY_WIDTH = 230;
const FRONT_SRC = { w: 340, h: 495 };
const BACK_SRC = { w: 340, h: 485 };

type Region = { key: string; x: number; y: number; w: number; h: number; round?: boolean };

const FRONT_REGIONS: Region[] = [
  { key: 'shoulders', x: 50, y: 86, w: 52, h: 44, round: true },
  { key: 'shoulders', x: 190, y: 86, w: 52, h: 44, round: true },
  { key: 'chest', x: 88, y: 90, w: 118, h: 46 },
  { key: 'biceps', x: 55, y: 124, w: 35, h: 65 },
  { key: 'biceps', x: 203, y: 123, w: 35, h: 66 },
  { key: 'core', x: 96, y: 135, w: 96, h: 106 },
  { key: 'quadriceps', x: 86, y: 238, w: 45, h: 112 },
  { key: 'quadriceps', x: 161, y: 237, w: 45, h: 113 },
];

const BACK_REGIONS: Region[] = [
  { key: 'shoulders', x: 65, y: 82, w: 60, h: 56, round: true },
  { key: 'shoulders', x: 199, y: 82, w: 60, h: 56, round: true },
  { key: 'back', x: 78, y: 118, w: 170, h: 60 },
  { key: 'triceps', x: 60, y: 120, w: 38, h: 86 },
  { key: 'triceps', x: 236, y: 120, w: 38, h: 86 },
  { key: 'glutes', x: 108, y: 205, w: 110, h: 56 },
  { key: 'hamstrings', x: 114, y: 260, w: 48, h: 90 },
  { key: 'hamstrings', x: 163, y: 259, w: 48, h: 91 },
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
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
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
