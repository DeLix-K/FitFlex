import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  // Same fade-edge affordance as History's filter chips -- on a narrow
  // screen (Shop's 4 segments in particular) the row doesn't fully fit and
  // needs a visual cue that there's more to scroll to, not just silent
  // horizontal overflow.
  const [rowWidth, setRowWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const showRightFade = scrollX + rowWidth < contentWidth - 4;

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}
        onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentWidth(w)}
        onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={32}
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
      {showRightFade && (
        <LinearGradient
          colors={[`${dark.background}00`, dark.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fadeRight}
          pointerEvents="none"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: dark.background,
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
  },
  scroll: {
    flexGrow: 0,
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
  fadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
  },
});
