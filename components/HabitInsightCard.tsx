import { StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';

export default function HabitInsightCard({ insight }: { insight: string | null }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>💡 Habit Insight</Text>
      {insight ? (
        <Text style={styles.text}>{insight}</Text>
      ) : (
        <Text style={styles.emptyText}>
          Keep logging — once there's enough history, real patterns between your habits and your
          workouts or sleep will show up here.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: dark.accentDark,
    backgroundColor: dark.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  title: {
    color: dark.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  text: {
    color: dark.text,
    fontSize: 13,
    lineHeight: 19,
  },
  emptyText: {
    color: dark.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
