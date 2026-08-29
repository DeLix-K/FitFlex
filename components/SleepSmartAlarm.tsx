import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { fetchSleepGoal, parseTimeToHm, timeStringToLabel, updateSleepGoal } from '../lib/sleep';
import { dark } from '../lib/theme';
import {
  cancelWakeReminder,
  hasNotificationPermission,
  isWakeReminderScheduled,
  requestNotificationPermission,
  scheduleWakeReminder,
  wakeReminderSupported,
} from '../lib/wakeAlarm';

const WAKE_TIME_OPTIONS = ['05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30'];
const GOAL_HOUR_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9];

export default function SleepSmartAlarm() {
  const [loading, setLoading] = useState(true);
  const [wakeTime, setWakeTime] = useState('07:00');
  const [goalHours, setGoalHours] = useState(8);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [goal, scheduled] = await Promise.all([fetchSleepGoal(), isWakeReminderScheduled()]);
        setWakeTime(goal.targetWakeTime.slice(0, 5));
        setGoalHours(goal.sleepGoalHours);
        setEnabled(scheduled);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persistGoal = async (nextWakeTime: string, nextGoalHours: number) => {
    setError(null);
    try {
      await updateSleepGoal({ sleepGoalHours: nextGoalHours, targetWakeTime: `${nextWakeTime}:00` });
      if (enabled) {
        const { hour, minute } = parseTimeToHm(nextWakeTime);
        await scheduleWakeReminder(hour, minute);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handlePickWakeTime = async (time: string) => {
    setWakeTime(time);
    await persistGoal(time, goalHours);
  };

  const handlePickGoalHours = async (hours: number) => {
    setGoalHours(hours);
    await persistGoal(wakeTime, hours);
  };

  const handleToggle = async (next: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (next) {
        const already = await hasNotificationPermission();
        const granted = already || (await requestNotificationPermission());
        if (!granted) {
          setError('Notification permission was denied — enable it in Settings to use the wake reminder.');
          setBusy(false);
          return;
        }
        const { hour, minute } = parseTimeToHm(wakeTime);
        await scheduleWakeReminder(hour, minute);
      } else {
        await cancelWakeReminder();
      }
      setEnabled(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={dark.accent} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>⏰ Wake-Up Reminder</Text>
        {wakeReminderSupported && (
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            disabled={busy}
            trackColor={{ true: dark.accent, false: dark.border }}
          />
        )}
      </View>
      {wakeReminderSupported ? (
        <Text style={styles.hint}>
          A scheduled reminder, not a true sleep-optimized alarm — keep your phone's real alarm as
          backup.
        </Text>
      ) : (
        <Text style={styles.hint}>
          Wake reminders only work in the mobile app, not this web preview — the settings below
          still save to your sleep goal.
        </Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.label}>Wake time</Text>
      <View style={styles.chipsWrap}>
        {WAKE_TIME_OPTIONS.map((t) => (
          <Pressable
            key={t}
            style={[styles.chip, wakeTime === t && styles.chipActive]}
            onPress={() => handlePickWakeTime(t)}
          >
            <Text style={[styles.chipText, wakeTime === t && styles.chipTextActive]}>
              {timeStringToLabel(t)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Sleep goal</Text>
      <View style={styles.chipsWrap}>
        {GOAL_HOUR_OPTIONS.map((h) => (
          <Pressable
            key={h}
            style={[styles.chip, goalHours === h && styles.chipActive]}
            onPress={() => handlePickGoalHours(h)}
          >
            <Text style={[styles.chipText, goalHours === h && styles.chipTextActive]}>{h}h</Text>
          </Pressable>
        ))}
      </View>
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
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: dark.text,
    fontSize: 15,
    fontWeight: '700',
  },
  hint: {
    color: dark.textFaint,
    fontSize: 11,
    marginTop: 4,
    marginBottom: 10,
  },
  error: {
    color: dark.danger,
    fontSize: 12,
    marginBottom: 8,
  },
  label: {
    color: dark.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 6,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: {
    borderColor: dark.accent,
    backgroundColor: dark.surfaceElevated,
  },
  chipText: {
    color: dark.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: dark.accent,
  },
});
