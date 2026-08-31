import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { createTimeSlot, deleteSlot, fetchMySlots } from '../lib/trainerDashboard';
import { dark } from '../lib/theme';
import type { SlotType, TrainerTimeSlot } from '../lib/types';

const DAY_OFFSETS = [
  { label: 'Tomorrow', days: 1 },
  { label: '+2 days', days: 2 },
  { label: '+3 days', days: 3 },
  { label: '+5 days', days: 5 },
  { label: '+7 days', days: 7 },
];
const TIME_OPTIONS = [
  { label: '9:00 AM', hour: 9 },
  { label: '12:00 PM', hour: 12 },
  { label: '3:00 PM', hour: 15 },
  { label: '6:00 PM', hour: 18 },
  { label: '7:30 PM', hour: 19.5 },
];

function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// No date-time picker library is installed (adding one is a real new
// native dependency, another EAS rebuild) -- quick-pick day/time chips give
// genuinely functional scheduling without that cost.
export default function AvailabilityManager() {
  const [slots, setSlots] = useState<TrainerTimeSlot[]>([]);
  const [bookedNames, setBookedNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [dayOffset, setDayOffset] = useState(1);
  const [hour, setHour] = useState(9);
  const [slotType, setSlotType] = useState<SlotType>('session');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await fetchMySlots();
      setSlots(result.slots);
      setBookedNames(result.bookedNames);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const addSlot = async () => {
    setAdding(true);
    setError(null);
    try {
      const startsAt = new Date();
      startsAt.setDate(startsAt.getDate() + dayOffset);
      startsAt.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0);
      await createTimeSlot({
        startsAt: startsAt.toISOString(),
        durationMinutes: slotType === 'intro' ? 15 : 30,
        slotType,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteSlot(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const upcoming = slots.filter((s) => s.status !== 'cancelled' && new Date(s.starts_at) > new Date());

  if (loading) return <ActivityIndicator color={dark.accent} style={{ marginVertical: 16 }} />;

  return (
    <View>
      <View style={styles.addCard}>
        <Text style={styles.label}>Slot type</Text>
        <View style={styles.row}>
          <Pressable style={[styles.chip, slotType === 'session' && styles.chipActive]} onPress={() => setSlotType('session')}>
            <Text style={[styles.chipText, slotType === 'session' && styles.chipTextActive]}>Session (30 min)</Text>
          </Pressable>
          <Pressable style={[styles.chip, slotType === 'intro' && styles.chipActive]} onPress={() => setSlotType('intro')}>
            <Text style={[styles.chipText, slotType === 'intro' && styles.chipTextActive]}>Free Intro (15 min)</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Day</Text>
        <View style={styles.row}>
          {DAY_OFFSETS.map((d) => (
            <Pressable key={d.days} style={[styles.chip, dayOffset === d.days && styles.chipActive]} onPress={() => setDayOffset(d.days)}>
              <Text style={[styles.chipText, dayOffset === d.days && styles.chipTextActive]}>{d.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Time</Text>
        <View style={styles.row}>
          {TIME_OPTIONS.map((t) => (
            <Pressable key={t.label} style={[styles.chip, hour === t.hour && styles.chipActive]} onPress={() => setHour(t.hour)}>
              <Text style={[styles.chipText, hour === t.hour && styles.chipTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.addButton} onPress={addSlot} disabled={adding}>
          {adding ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.addButtonText}>+ Add Slot</Text>}
        </Pressable>
      </View>

      {upcoming.length === 0 ? (
        <Text style={styles.empty}>No upcoming slots yet.</Text>
      ) : (
        upcoming.map((slot) => (
          <View key={slot.id} style={styles.slotRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.slotTime}>
                {formatSlotTime(slot.starts_at)} · {slot.slot_type === 'intro' ? 'Free Intro' : 'Session'}
              </Text>
              <Text style={styles.slotStatus}>
                {slot.status === 'booked' ? `Booked by ${bookedNames.get(slot.booked_by_user_id!) ?? 'a client'}` : 'Open'}
              </Text>
            </View>
            <Pressable onPress={() => remove(slot.id)}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addCard: { borderWidth: 1, borderColor: dark.border, backgroundColor: dark.surface, borderRadius: 14, padding: 14, marginBottom: 14 },
  label: { color: dark.textMuted, fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: dark.border, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10 },
  chipActive: { backgroundColor: dark.accent, borderColor: dark.accent },
  chipText: { color: dark.textMuted, fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: '#0a0a0a' },
  error: { color: dark.danger, marginTop: 10, fontSize: 12 },
  addButton: { backgroundColor: dark.accent, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 14 },
  addButtonText: { color: '#0a0a0a', fontWeight: '700', fontSize: 12 },
  empty: { color: dark.textFaint, fontSize: 12, textAlign: 'center', marginVertical: 8 },
  slotRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: dark.border, backgroundColor: dark.surface, borderRadius: 10, padding: 12, marginBottom: 8 },
  slotTime: { color: dark.text, fontSize: 13, fontWeight: '600' },
  slotStatus: { color: dark.textFaint, fontSize: 11, marginTop: 2 },
  remove: { color: dark.danger, fontSize: 12, fontWeight: '600' },
});
