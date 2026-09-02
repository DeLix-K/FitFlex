import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { dark } from '../lib/theme';

// Shared pill-row switcher for the new consolidated tabs (My Plans+Outdoor,
// Wellness+Sleep+Habits, Progress, Shop) -- each merged tab shows this above
// the underlying screen, which renders unchanged below it.
export default function SegmentedHeader<T extends string>({
  segments,
  active,
  onChange,
}: {
  segments: { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {segments.map((s) => (
        <Pressable
          key={s.value}
          style={[styles.chip, active === s.value && styles.chipActive]}
          onPress={() => onChange(s.value)}
        >
          <Text style={[styles.chipText, active === s.value && styles.chipTextActive]}>{s.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    backgroundColor: dark.background,
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
  },
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14 },
  chip: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: dark.surface,
  },
  chipActive: { backgroundColor: dark.accent, borderColor: dark.accent },
  chipText: { color: dark.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0a0a0a' },
});
