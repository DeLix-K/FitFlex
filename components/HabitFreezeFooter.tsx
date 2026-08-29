import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';

export default function HabitFreezeFooter({
  freezeBalance,
  alreadyCoveredToday,
  onUseFreeze,
}: {
  freezeBalance: number;
  alreadyCoveredToday: boolean;
  onUseFreeze: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = busy || freezeBalance < 1 || alreadyCoveredToday;

  const handlePress = async () => {
    setBusy(true);
    setError(null);
    try {
      await onUseFreeze();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.button, disabled && styles.buttonDisabled]} onPress={handlePress} disabled={disabled}>
        {busy ? (
          <ActivityIndicator size="small" color={dark.accent} />
        ) : (
          <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
            {alreadyCoveredToday
              ? '✅ Today is protected'
              : `🛡️ Use a Freeze for Today (${freezeBalance} available)`}
          </Text>
        )}
      </Pressable>
      <Text style={styles.hint}>
        Life happens — spending a freeze keeps today's Health Momentum streak alive without
        pretending you did a habit you didn't.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 4,
    marginBottom: 20,
  },
  error: {
    color: dark.danger,
    fontSize: 12,
    marginBottom: 8,
  },
  button: {
    borderWidth: 1,
    borderColor: dark.accent,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    borderColor: dark.border,
  },
  buttonText: {
    color: dark.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  buttonTextDisabled: {
    color: dark.textFaint,
  },
  hint: {
    color: dark.textFaint,
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
});
