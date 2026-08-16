import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ExercisePicker from '../components/ExercisePicker';
import {
  deliverPlan,
  fetchMyOrdersAsTrainer,
  fetchMyTrainerProfile,
  startTrainerOnboarding,
} from '../lib/trainerDashboard';
import { colors } from '../lib/theme';
import type { Exercise, TrainerOrderView, TrainerProfile } from '../lib/types';

type DraftItem = { exerciseId: string; name: string; sets: string; reps: string; notes: string };
type Mode = { mode: 'list' } | { mode: 'build'; order: TrainerOrderView };

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function BuildPlanView({
  order,
  onBack,
  onDelivered,
}: {
  order: TrainerOrderView;
  onBack: () => void;
  onDelivered: () => void;
}) {
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addExercise = (exercise: Exercise) => {
    setPickerVisible(false);
    setItems((current) => [
      ...current,
      { exerciseId: exercise.id, name: exercise.name, sets: '', reps: '', notes: '' },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: 'sets' | 'reps' | 'notes', value: string) => {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleDeliver = async () => {
    if (!planName.trim()) {
      setError('Give the plan a name.');
      return;
    }
    if (items.length === 0) {
      setError('Add at least one exercise.');
      return;
    }
    setDelivering(true);
    setError(null);
    try {
      await deliverPlan({
        orderId: order.id,
        planName: planName.trim(),
        planDescription: planDescription.trim(),
        items: items.map((item) => ({
          exerciseId: item.exerciseId,
          sets: item.sets === '' ? null : Number(item.sets),
          reps: item.reps === '' ? null : Number(item.reps),
          notes: item.notes.trim(),
        })),
      });
      onDelivered();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDelivering(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>{'< Trainer Dashboard'}</Text>
      </Pressable>

      <Text style={styles.title}>Build Plan for {order.client_display_name}</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Plan name (e.g. 8-Week Strength Program)"
        value={planName}
        onChangeText={setPlanName}
      />
      <TextInput
        style={styles.input}
        placeholder="Description (optional)"
        value={planDescription}
        onChangeText={setPlanDescription}
      />

      <FlatList
        data={items}
        keyExtractor={(_, index) => String(index)}
        scrollEnabled={false}
        contentContainerStyle={styles.itemsList}
        ListEmptyComponent={
          <Text style={styles.empty}>No exercises added yet. Tap "+ Add Exercise" below.</Text>
        }
        renderItem={({ item, index }) => (
          <View style={styles.itemRow}>
            <View style={styles.itemTop}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Pressable onPress={() => removeItem(index)}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
            <View style={styles.itemFields}>
              <TextInput
                style={styles.fieldInput}
                placeholder="Sets"
                keyboardType="number-pad"
                value={item.sets}
                onChangeText={(text) => updateItem(index, 'sets', text)}
              />
              <TextInput
                style={styles.fieldInput}
                placeholder="Reps"
                keyboardType="number-pad"
                value={item.reps}
                onChangeText={(text) => updateItem(index, 'reps', text)}
              />
            </View>
            <TextInput
              style={styles.notesInput}
              placeholder="Notes (optional)"
              value={item.notes}
              onChangeText={(text) => updateItem(index, 'notes', text)}
            />
          </View>
        )}
      />

      <Pressable style={styles.addButton} onPress={() => setPickerVisible(true)}>
        <Text style={styles.addButtonText}>+ Add Exercise</Text>
      </Pressable>

      <Pressable style={styles.deliverButton} onPress={handleDeliver} disabled={delivering}>
        {delivering ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.deliverButtonText}>Deliver Plan</Text>
        )}
      </Pressable>

      <ExercisePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={addExercise}
      />
    </View>
  );
}

export default function TrainerDashboardScreen() {
  const [mode, setMode] = useState<Mode>({ mode: 'list' });
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [orders, setOrders] = useState<TrainerOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [trainerProfile, myOrders] = await Promise.all([
        fetchMyTrainerProfile(),
        fetchMyOrdersAsTrainer(),
      ]);
      setProfile(trainerProfile);
      setOrders(myOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (mode.mode !== 'list') return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [mode.mode, load]);

  const handleOnboard = async () => {
    setOnboarding(true);
    setError(null);
    try {
      const { payoutsEnabled } = await startTrainerOnboarding();
      if (payoutsEnabled) await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOnboarding(false);
    }
  };

  if (mode.mode === 'build') {
    return (
      <BuildPlanView
        order={mode.order}
        onBack={() => setMode({ mode: 'list' })}
        onDelivered={() => setMode({ mode: 'list' })}
      />
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>
          No trainer profile is set up for your account yet — reach out to the admin.
        </Text>
      </View>
    );
  }

  const readyOrders = orders.filter((o) => o.status === 'paid');
  const fulfilledOrders = orders.filter((o) => o.status === 'fulfilled');

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Trainer Dashboard</Text>
          {error && <Text style={styles.error}>{error}</Text>}

          {!profile.payouts_enabled ? (
            <View style={styles.payoutCard}>
              <Text style={styles.payoutText}>
                Set up payouts with Stripe to start accepting orders.
              </Text>
              <Pressable style={styles.onboardButton} onPress={handleOnboard} disabled={onboarding}>
                {onboarding ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.onboardButtonText}>Set Up Payouts</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.payoutCardEnabled}>
              <Text style={styles.payoutTextEnabled}>✓ Payouts enabled</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>
            Orders to Fulfill {readyOrders.length > 0 ? `(${readyOrders.length})` : ''}
          </Text>
        </>
      }
      data={readyOrders}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<Text style={styles.empty}>No orders waiting right now.</Text>}
      renderItem={({ item }) => (
        <View style={styles.orderCard}>
          <View>
            <Text style={styles.orderClient}>{item.client_display_name}</Text>
            <Text style={styles.orderPrice}>{formatPrice(item.amount_cents)}</Text>
          </View>
          <Pressable
            style={styles.buildButton}
            onPress={() => setMode({ mode: 'build', order: item })}
          >
            <Text style={styles.buildButtonText}>Build Plan</Text>
          </Pressable>
        </View>
      )}
      ListFooterComponent={
        fulfilledOrders.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Delivered ({fulfilledOrders.length})</Text>
            {fulfilledOrders.map((item) => (
              <View key={item.id} style={styles.deliveredRow}>
                <Text style={styles.orderClient}>{item.client_display_name}</Text>
                <Text style={styles.deliveredLabel}>✓ Delivered</Text>
              </View>
            ))}
          </>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  back: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 12,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
  },
  empty: {
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  payoutCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  payoutText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
  },
  onboardButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  onboardButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  payoutCardEnabled: {
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    padding: 14,
  },
  payoutTextEnabled: {
    color: colors.success,
    fontWeight: '700',
  },
  orderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  orderClient: {
    fontSize: 15,
    fontWeight: '700',
  },
  orderPrice: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  buildButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  buildButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  deliveredRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  deliveredLabel: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 15,
  },
  itemsList: {
    paddingBottom: 4,
  },
  itemRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
  },
  remove: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  itemFields: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  notesInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  addButton: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  addButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
  deliverButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 40,
  },
  deliverButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
