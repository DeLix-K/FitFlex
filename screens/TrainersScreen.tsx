import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { buyTrainerPlan, fetchMyOrdersAsClient, fetchTrainers } from '../lib/trainers';
import { colors } from '../lib/theme';
import type { TrainerOrderView, TrainerProfile } from '../lib/types';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting payment',
  paid: 'Trainer is building your plan',
  fulfilled: 'Delivered — check My Plans',
  refunded: 'Refunded',
};

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function TrainersScreen() {
  const [trainers, setTrainers] = useState<TrainerProfile[]>([]);
  const [orders, setOrders] = useState<TrainerOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [trainerList, myOrders] = await Promise.all([fetchTrainers(), fetchMyOrdersAsClient()]);
      setTrainers(trainerList);
      setOrders(myOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleBuy = async (trainerProfileId: string) => {
    setBuyingId(trainerProfileId);
    setError(null);
    try {
      await buyTrainerPlan(trainerProfileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBuyingId(null);
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
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Trainers</Text>
          <Text style={styles.subtitle}>
            Buy a custom workout plan built for you by a real trainer or nutritionist.
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}

          {orders.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>My Orders</Text>
              {orders.map((order) => (
                <View key={order.id} style={styles.orderRow}>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderTrainer}>{order.trainer_display_name}</Text>
                    <Text style={styles.orderStatus}>{STATUS_LABEL[order.status]}</Text>
                  </View>
                  <Text style={styles.orderPrice}>{formatPrice(order.amount_cents)}</Text>
                </View>
              ))}
            </>
          )}

          <Text style={styles.sectionTitle}>Browse Trainers</Text>
        </>
      }
      data={trainers}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <Text style={styles.empty}>No trainers are accepting orders yet — check back soon.</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardName}>{item.display_name}</Text>
            <Text style={styles.cardPrice}>{formatPrice(item.price_cents)}</Text>
          </View>
          {item.specialty ? <Text style={styles.cardSpecialty}>{item.specialty}</Text> : null}
          {item.bio ? <Text style={styles.cardBio}>{item.bio}</Text> : null}

          <Pressable
            style={styles.buyButton}
            onPress={() => handleBuy(item.id)}
            disabled={buyingId === item.id}
          >
            {buyingId === item.id ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buyButtonText}>Buy Custom Plan</Text>
            )}
          </Pressable>
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
    marginBottom: 16,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 8,
  },
  empty: {
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 12,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  orderInfo: {
    flex: 1,
  },
  orderTrainer: {
    fontSize: 14,
    fontWeight: '700',
  },
  orderStatus: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  orderPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  cardSpecialty: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  cardBio: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 6,
  },
  buyButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  buyButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
