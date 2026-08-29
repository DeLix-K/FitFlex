import { StyleSheet, Text, View } from 'react-native';
import type { SleepDebt } from '../lib/sleep';
import { dark } from '../lib/theme';

function batteryIcon(debtMinutes: number): string {
  if (debtMinutes <= 30) return '🔋';
  if (debtMinutes <= 120) return '🪫';
  return '🪫';
}

function debtDescription(debtMinutes: number, nightsCounted: number): string {
  const hours = (debtMinutes / 60).toFixed(1);
  if (debtMinutes <= 30) {
    return `You're on track over your last ${nightsCounted} logged night${nightsCounted === 1 ? '' : 's'}.`;
  }
  if (debtMinutes <= 120) {
    return `You're operating on a slight deficit. Aim for a bit of extra sleep tonight to start replenishing.`;
  }
  return `You're carrying a real deficit (${hours}h over your last ${nightsCounted} logged night${
    nightsCounted === 1 ? '' : 's'
  }). Prioritize an earlier night when you can.`;
}

export default function SleepDebtCard({ debt }: { debt: SleepDebt | null }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Your Sleep Debt Tank</Text>
      {debt == null ? (
        <Text style={styles.emptyText}>Log or sync a few nights to see your sleep debt.</Text>
      ) : (
        <>
          <View style={styles.row}>
            <Text style={styles.icon}>{batteryIcon(debt.debtMinutes)}</Text>
            <Text style={styles.hours}>{(debt.debtMinutes / 60).toFixed(1)} Hours Debt</Text>
          </View>
          <Text style={styles.description}>{debtDescription(debt.debtMinutes, debt.nightsCounted)}</Text>
        </>
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
    padding: 18,
    marginBottom: 14,
  },
  title: {
    color: dark.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptyText: {
    color: dark.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  icon: {
    fontSize: 26,
  },
  hours: {
    color: dark.text,
    fontSize: 20,
    fontWeight: '800',
  },
  description: {
    color: dark.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
