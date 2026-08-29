import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';
import type { SleepLog } from '../lib/types';

function formatDuration(minutes: number | null): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

// Rule-based, not AI-generated -- an honest mapping from the real recovery
// score to a qualitative recommendation, same pattern as SleepScreen's
// existing scoreLabel().
function recoveryMessage(score: number | null): string {
  if (score == null) return 'Log or sync last night to see how recovered you are today.';
  if (score >= 85) return 'Your recovery was strong — a good day to push your hardest planned session.';
  if (score >= 70) return 'Solid recovery. Your planned training should feel manageable today.';
  if (score >= 50) return 'Recovery is fair. Consider keeping today a bit lighter than planned.';
  return 'Recovery is low. A lighter session or rest day would serve you better today.';
}

const CHECKLIST_ITEMS = [
  'Dim the lights',
  'Put your phone away',
  'Try 2 minutes of breathwork',
  'Keep the room cool',
];

export default function SleepGreetingCard({
  displayName,
  latest,
  recoveryScore,
  recommendedBedtimeLabel,
  caffeineCutoffLabel,
}: {
  displayName: string;
  latest: SleepLog | null;
  recoveryScore: number | null;
  recommendedBedtimeLabel: string;
  caffeineCutoffLabel: string;
}) {
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(() => CHECKLIST_ITEMS.map(() => false));

  const hour = new Date().getHours();
  const isMorning = hour >= 4 && hour < 12;

  if (isMorning) {
    return (
      <View style={styles.card}>
        <Text style={styles.greeting}>Good morning, {displayName}!</Text>
        {latest?.duration_minutes != null ? (
          <Text style={styles.sub}>You slept {formatDuration(latest.duration_minutes)}.</Text>
        ) : (
          <Text style={styles.sub}>No sleep logged for last night yet.</Text>
        )}
        <Text style={styles.message}>{recoveryMessage(recoveryScore)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.greeting}>Wind-down window</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Recommended bedtime</Text>
        <Text style={styles.rowValue}>{recommendedBedtimeLabel}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>General caffeine cutoff</Text>
        <Text style={styles.rowValue}>{caffeineCutoffLabel}</Text>
      </View>
      <Text style={styles.hint}>Based on your sleep goal — not tracked caffeine intake.</Text>

      <Pressable style={styles.checklistButton} onPress={() => setChecklistOpen((v) => !v)}>
        <Text style={styles.checklistButtonText}>
          {checklistOpen ? 'Hide Wind-Down Checklist' : 'Start Wind-Down Checklist'}
        </Text>
      </Pressable>

      {checklistOpen && (
        <View style={styles.checklist}>
          {CHECKLIST_ITEMS.map((item, i) => (
            <Pressable
              key={item}
              style={styles.checklistRow}
              onPress={() => setChecked((c) => c.map((v, idx) => (idx === i ? !v : v)))}
            >
              <View style={[styles.checkbox, checked[i] && styles.checkboxChecked]}>
                {checked[i] && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={[styles.checklistText, checked[i] && styles.checklistTextDone]}>{item}</Text>
            </Pressable>
          ))}
        </View>
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
  greeting: {
    color: dark.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  sub: {
    color: dark.textMuted,
    fontSize: 13,
    marginBottom: 6,
  },
  message: {
    color: dark.accent,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  rowLabel: {
    color: dark.textMuted,
    fontSize: 13,
  },
  rowValue: {
    color: dark.text,
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    color: dark.textFaint,
    fontSize: 11,
    marginTop: 6,
  },
  checklistButton: {
    marginTop: 14,
    backgroundColor: dark.accent,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  checklistButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 13,
  },
  checklist: {
    marginTop: 12,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: dark.accent,
    borderColor: dark.accent,
  },
  checkboxMark: {
    color: '#0a0a0a',
    fontSize: 12,
    fontWeight: '800',
  },
  checklistText: {
    color: dark.text,
    fontSize: 13,
  },
  checklistTextDone: {
    color: dark.textFaint,
    textDecorationLine: 'line-through',
  },
});
