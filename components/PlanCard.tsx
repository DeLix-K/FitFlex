import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PLAN_THEMES } from '../lib/plans';
import { dark } from '../lib/theme';
import type { PlanThemeKey } from '../lib/types';

export default function PlanCard({
  emoji,
  name,
  subtitle,
  themeKey,
  bodyFocus,
  onPress,
  compact,
}: {
  emoji: string | null;
  name: string;
  subtitle: string;
  themeKey: PlanThemeKey;
  bodyFocus?: { muscle: string; pct: number }[];
  onPress: () => void;
  compact?: boolean;
}) {
  const theme = PLAN_THEMES[themeKey];
  const topFocus = (bodyFocus ?? []).slice(0, 2);

  return (
    <Pressable
      style={[styles.card, compact && styles.cardCompact, { borderColor: theme.accent, backgroundColor: theme.surface }]}
      onPress={onPress}
    >
      <Text style={styles.emoji}>{emoji ?? '💪'}</Text>
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {subtitle}
      </Text>
      {topFocus.length > 0 && (
        <View style={styles.focusRow}>
          {topFocus.map((f) => (
            <View key={f.muscle} style={[styles.focusChip, { borderColor: theme.accent }]}>
              <Text style={[styles.focusChipText, { color: theme.accent }]}>
                {f.muscle} {f.pct}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    minWidth: 160,
    flex: 1,
  },
  cardCompact: {
    minWidth: 140,
  },
  emoji: {
    fontSize: 26,
    marginBottom: 6,
  },
  name: {
    color: dark.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    color: dark.textMuted,
    fontSize: 12,
  },
  focusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  focusChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  focusChipText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
