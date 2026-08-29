import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';
import type { HabitWithStatus } from '../lib/types';

const HOLD_TICK_MS = 150;

const AUTO_SYNC_LABEL: Record<string, string> = {
  sleep_duration: 'Auto-logged from Sleep tab',
  oura_steps: 'Auto-logged from Oura steps',
  workout_done: 'Auto-logged from a workout',
};

const TIER_LABEL: Record<string, string> = {
  gold: '🥇 Gold',
  silver: '🥈 Silver',
  bronze: '🥉 Bronze',
};

function safeHaptic(fn: () => Promise<void>) {
  fn().catch(() => {
    // Haptics aren't available on every platform (e.g. web) — never let
    // that break the actual habit interaction.
  });
}

export default function HabitCard({
  habit,
  busy,
  onToggleBoolean,
  onSaveProgress,
  onDelete,
}: {
  habit: HabitWithStatus;
  busy: boolean;
  onToggleBoolean: () => void;
  onSaveProgress: (value: number) => void;
  onDelete: () => void;
}) {
  const [localProgress, setLocalProgress] = useState(habit.progress_today ?? 0);
  const [holding, setHolding] = useState(false);
  const progressRef = useRef(localProgress);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reachedTargetRef = useRef(habit.done_today);

  useEffect(() => {
    if (!holding) {
      setLocalProgress(habit.progress_today ?? 0);
      progressRef.current = habit.progress_today ?? 0;
      reachedTargetRef.current = habit.done_today;
    }
  }, [habit.progress_today, habit.done_today, holding]);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const stopHold = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setHolding(false);
    onSaveProgress(progressRef.current);
  };

  if (habit.auto_sync_source) {
    return (
      <View style={[styles.card, habit.done_today && styles.cardDone]}>
        <View style={styles.autoRow}>
          <Text style={styles.autoTag}>⚡ Auto-Synced</Text>
          <Text style={[styles.statusTag, habit.done_today ? styles.statusDone : styles.statusPending]}>
            {habit.done_today ? 'COMPLETED' : 'Not yet'}
          </Text>
        </View>
        <Text style={styles.habitName}>{habit.name}</Text>
        <Text style={styles.autoSubtext}>
          {habit.done_today ? AUTO_SYNC_LABEL[habit.auto_sync_source] : `Target: ${habit.target_value ?? '—'} ${habit.unit ?? ''}`}
        </Text>
        {!habit.done_today && (
          <Pressable
            style={styles.manualFallback}
            onPress={() =>
              habit.habit_type === 'numeric' && habit.target_value != null
                ? onSaveProgress(habit.target_value)
                : onToggleBoolean()
            }
            disabled={busy}
          >
            <Text style={styles.manualFallbackText}>Mark done manually</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (habit.habit_type === 'numeric' && habit.target_value != null) {
    const stepSize = Math.max(1, Math.round(habit.target_value / 10));
    const pct = Math.min(1, localProgress / habit.target_value);

    const startHold = () => {
      if (intervalRef.current) return;
      setHolding(true);
      intervalRef.current = setInterval(() => {
        progressRef.current = Math.min(habit.target_value!, progressRef.current + stepSize);
        setLocalProgress(progressRef.current);
        if (progressRef.current >= habit.target_value! && !reachedTargetRef.current) {
          reachedTargetRef.current = true;
          safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
          stopHold();
        } else {
          safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
        }
      }, HOLD_TICK_MS);
    };

    return (
      <View style={[styles.card, habit.done_today && styles.cardDone]}>
        <View style={styles.autoRow}>
          <Text style={styles.habitName}>💧 {habit.name}</Text>
          {habit.tier_today && <Text style={styles.tierTag}>{TIER_LABEL[habit.tier_today]}</Text>}
        </View>
        <Pressable
          style={styles.fillTrack}
          onPressIn={startHold}
          onPressOut={stopHold}
          disabled={busy || habit.done_today}
        >
          <View style={[styles.fillBar, { width: `${pct * 100}%` }]} />
          <View style={styles.fillLabelWrap}>
            <Text style={styles.fillLabel}>
              {Math.round(localProgress)} / {habit.target_value} {habit.unit ?? ''}
            </Text>
          </View>
        </Pressable>
        <Text style={styles.holdHint}>{habit.done_today ? 'Complete for today 🎉' : 'Hold to fill'}</Text>
      </View>
    );
  }

  // Boolean, manual habit.
  return (
    <View style={[styles.card, habit.done_today && styles.cardDone]}>
      <Pressable
        style={styles.booleanRow}
        onPress={() => {
          safeHaptic(() =>
            habit.done_today
              ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          );
          onToggleBoolean();
        }}
        disabled={busy}
      >
        <View style={[styles.checkbox, habit.done_today && styles.checkboxDone]}>
          {busy ? (
            <ActivityIndicator size="small" color={habit.done_today ? '#0a0a0a' : dark.accent} />
          ) : (
            habit.done_today && <Text style={styles.checkboxMark}>✓</Text>
          )}
        </View>
        <View style={styles.rowMiddle}>
          <Text style={styles.habitName}>{habit.name}</Text>
          <Text style={styles.habitStreak}>
            {habit.current_streak > 0 ? `🔥 ${habit.current_streak} day streak` : 'Tap to complete'}
          </Text>
        </View>
        <Pressable onPress={onDelete} hitSlop={8}>
          <Text style={styles.remove}>✕</Text>
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardDone: {
    borderColor: dark.accent,
  },
  autoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  autoTag: {
    color: dark.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tierTag: {
    color: dark.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  statusTag: {
    fontSize: 10,
    fontWeight: '700',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  statusDone: {
    color: '#0a0a0a',
    backgroundColor: dark.accent,
  },
  statusPending: {
    color: dark.textMuted,
    backgroundColor: dark.surfaceElevated,
  },
  habitName: {
    fontSize: 15,
    fontWeight: '700',
    color: dark.text,
  },
  autoSubtext: {
    color: dark.textFaint,
    fontSize: 11,
    marginTop: 4,
  },
  manualFallback: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  manualFallbackText: {
    color: dark.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  fillTrack: {
    height: 34,
    borderRadius: 10,
    backgroundColor: dark.surfaceElevated,
    overflow: 'hidden',
    justifyContent: 'center',
    marginTop: 6,
  },
  fillBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: dark.accent,
    opacity: 0.85,
  },
  fillLabelWrap: {
    paddingHorizontal: 10,
  },
  fillLabel: {
    color: dark.text,
    fontSize: 12,
    fontWeight: '700',
  },
  holdHint: {
    color: dark.textFaint,
    fontSize: 11,
    marginTop: 6,
  },
  booleanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: dark.accent,
  },
  checkboxMark: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
  rowMiddle: {
    flex: 1,
  },
  habitStreak: {
    fontSize: 11,
    color: dark.textMuted,
    marginTop: 2,
  },
  remove: {
    color: dark.textFaint,
    fontSize: 16,
    paddingHorizontal: 4,
  },
});
