import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';

export const MILESTONES = [7, 30, 50, 100, 365] as const;

const MILESTONE_ICONS: Record<number, string> = {
  7: '🔥',
  30: '🥉',
  50: '🥈',
  100: '🥇',
  365: '👑',
};

export function nextMilestone(longestStreak: number): number | null {
  return MILESTONES.find((m) => m > longestStreak) ?? null;
}

export default function MilestoneBadges({ longestStreak }: { longestStreak: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {MILESTONES.map((milestone) => {
        const unlocked = longestStreak >= milestone;
        return (
          <View key={milestone} style={[styles.badge, unlocked && styles.badgeUnlocked]}>
            <Text style={[styles.badgeIcon, !unlocked && styles.badgeIconLocked]}>
              {unlocked ? MILESTONE_ICONS[milestone] : '🔒'}
            </Text>
            <Text style={[styles.badgeLabel, unlocked && styles.badgeLabelUnlocked]}>{milestone}</Text>
            <Text style={styles.badgeSub}>days</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 10,
    paddingVertical: 4,
  },
  badge: {
    width: 68,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  badgeUnlocked: {
    borderColor: dark.accentDark,
    backgroundColor: dark.surfaceElevated,
  },
  badgeIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  badgeIconLocked: {
    opacity: 0.4,
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: dark.textFaint,
  },
  badgeLabelUnlocked: {
    color: dark.text,
  },
  badgeSub: {
    fontSize: 9,
    color: dark.textFaint,
    fontWeight: '600',
    marginTop: 1,
  },
});
