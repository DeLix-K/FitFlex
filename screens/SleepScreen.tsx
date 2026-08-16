import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetchSleepHistory, logSleepManually, syncOuraSleep, yesterdayLocalDate } from '../lib/sleep';
import { colors } from '../lib/theme';
import type { SleepLog } from '../lib/types';

function formatDuration(minutes: number | null): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function SleepScreen() {
  const [history, setHistory] = useState<SleepLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [dateInput, setDateInput] = useState(yesterdayLocalDate());
  const [hoursInput, setHoursInput] = useState('');
  const [quality, setQuality] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchSleepHistory();
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const sync = useCallback(async () => {
    try {
      const result = await syncOuraSleep();
      if (result.error) setSyncNote(result.error);
      else if (result.connected && result.synced > 0) setSyncNote(null);
      await load();
    } catch {
      // Oura sync is best-effort — manual logging still works without it.
    }
  }, [load]);

  useEffect(() => {
    setLoading(true);
    sync().finally(() => setLoading(false));
  }, [sync]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await sync();
    setRefreshing(false);
  }, [sync]);

  const openForm = () => {
    setDateInput(yesterdayLocalDate());
    setHoursInput('');
    setQuality(null);
    setNotes('');
    setFormVisible(true);
  };

  const handleSave = async () => {
    const hours = Number(hoursInput);
    if (!hoursInput || Number.isNaN(hours) || hours <= 0 || hours > 24) {
      setError('Enter a valid number of hours (0-24).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await logSleepManually({ sleepDate: dateInput, hours, qualityRating: quality, notes });
      setFormVisible(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Sleep</Text>
          <Text style={styles.subtitle}>
            Log your sleep manually, or connect Oura on the Wearables tab to sync it automatically.
          </Text>
          {syncNote && <Text style={styles.note}>{syncNote}</Text>}
          {error && <Text style={styles.error}>{error}</Text>}

          {formVisible ? (
            <View style={styles.form}>
              <Text style={styles.formLabel}>Date</Text>
              <TextInput
                style={styles.input}
                value={dateInput}
                onChangeText={setDateInput}
                placeholder="YYYY-MM-DD"
              />
              <Text style={styles.formLabel}>Hours slept</Text>
              <TextInput
                style={styles.input}
                value={hoursInput}
                onChangeText={setHoursInput}
                placeholder="e.g. 7.5"
                keyboardType="decimal-pad"
              />
              <Text style={styles.formLabel}>Quality (optional)</Text>
              <View style={styles.qualityRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    style={[styles.qualityDot, quality === n && styles.qualityDotSelected]}
                    onPress={() => setQuality(quality === n ? null : n)}
                  >
                    <Text style={[styles.qualityDotText, quality === n && styles.qualityDotTextSelected]}>
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.input}
                value={notes}
                onChangeText={setNotes}
                placeholder="Notes (optional)"
              />
              <View style={styles.formButtons}>
                <Pressable style={styles.cancelButton} onPress={() => setFormVisible(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={styles.logButton} onPress={openForm}>
              <Text style={styles.logButtonText}>+ Log Sleep</Text>
            </Pressable>
          )}

          <Text style={styles.sectionTitle}>Recent Nights</Text>
        </>
      }
      data={history}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<Text style={styles.empty}>No sleep logged yet.</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowDate}>{item.sleep_date}</Text>
            <Text style={styles.rowSource}>{item.source === 'oura' ? 'Oura' : 'Manual'}</Text>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.rowDuration}>{formatDuration(item.duration_minutes)}</Text>
            {item.sleep_score != null && (
              <Text style={styles.rowScore}>Score {item.sleep_score}</Text>
            )}
            {item.quality_rating != null && (
              <Text style={styles.rowScore}>Quality {item.quality_rating}/5</Text>
            )}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textFaint,
    marginTop: 4,
    marginBottom: 12,
  },
  note: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
  },
  logButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  logButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  form: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  qualityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  qualityDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityDotSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  qualityDotText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  qualityDotTextSelected: {
    color: '#fff',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  empty: {
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  rowLeft: {},
  rowDate: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowSource: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rowDuration: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  rowScore: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
