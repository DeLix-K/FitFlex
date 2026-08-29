import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { calm } from '../lib/theme';

// A single, deliberately hardcoded default stack (workout -> hydration +
// breathwork) rather than a full custom stack-builder, per this session's
// scoping call -- a fully custom builder is a meaningfully bigger feature,
// left as a natural Premium expansion later.
export default function HabitStackSuggestion({
  visible,
  glasses,
  onAddGlass,
}: {
  visible: boolean;
  glasses: number;
  onAddGlass: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (!visible || dismissed) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>🔗 Habit Stack</Text>
        <Pressable onPress={() => setDismissed(true)} hitSlop={8}>
          <Text style={styles.dismiss}>✕</Text>
        </Pressable>
      </View>
      <Text style={styles.text}>
        You logged a workout today — stack a quick win: drink a glass of water and try a minute of
        breathwork below.
      </Text>
      <Pressable style={styles.button} onPress={onAddGlass}>
        <Text style={styles.buttonText}>💧 +1 Glass ({glasses} today)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: calm.accent,
    backgroundColor: calm.surfaceElevated,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    color: calm.text,
    fontSize: 14,
    fontWeight: '700',
  },
  dismiss: {
    color: calm.textFaint,
    fontSize: 14,
    paddingHorizontal: 4,
  },
  text: {
    color: calm.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  button: {
    borderWidth: 1,
    borderColor: calm.accent,
    borderRadius: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: calm.accent,
    fontWeight: '700',
    fontSize: 12,
  },
});
