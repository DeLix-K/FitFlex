import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { buyTrainerPlan, fetchMyOrdersAsClient, fetchTrainers } from '../lib/trainers';
import { dark } from '../lib/theme';
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase() || '?';
}

export default function TrainersScreen() {
  const [trainers, setTrainers] = useState<TrainerProfile[]>([]);
  const [orders, setOrders] = useState<TrainerOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSpecialty, setActiveSpecialty] = useState<string | null>(null);

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

  const specialties = useMemo(() => {
    const set = new Set<string>();
    trainers.forEach((t) => {
      if (t.specialty) set.add(t.specialty);
    });
    return Array.from(set).sort();
  }, [trainers]);

  const filteredTrainers = useMemo(() => {
    if (!activeSpecialty) return trainers;
    return trainers.filter((t) => t.specialty === activeSpecialty);
  }, [trainers, activeSpecialty]);

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
        <ActivityIndicator color={dark.accent} />
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

          {specialties.length > 0 && (
            <View style={styles.filterRow}>
              <Pressable
                style={[styles.filterChip, activeSpecialty === null && styles.filterChipActive]}
                onPress={() => setActiveSpecialty(null)}
              >
                <Text style={[styles.filterChipText, activeSpecialty === null && styles.filterChipTextActive]}>
                  All
                </Text>
              </Pressable>
              {specialties.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.filterChip, activeSpecialty === s && styles.filterChipActive]}
                  onPress={() => setActiveSpecialty(s)}
                >
                  <Text style={[styles.filterChipText, activeSpecialty === s && styles.filterChipTextActive]}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      }
      data={filteredTrainers}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <Text style={styles.empty}>No trainers are accepting orders yet — check back soon.</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(item.display_name)}</Text>
            </View>
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.cardName}>{item.display_name}</Text>
              {item.specialty ? <Text style={styles.cardSpecialty}>{item.specialty}</Text> : null}
            </View>
            <Text style={styles.cardPrice}>{formatPrice(item.price_cents)}</Text>
          </View>
          {item.bio ? <Text style={styles.cardBio}>{item.bio}</Text> : null}

          <Pressable
            style={styles.buyButton}
            onPress={() => handleBuy(item.id)}
            disabled={buyingId === item.id}
          >
            {buyingId === item.id ? (
              <ActivityIndicator color="#0a0a0a" />
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
    backgroundColor: dark.background,
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
    backgroundColor: dark.background,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: dark.text,
  },
  subtitle: {
    fontSize: 13,
    color: dark.textFaint,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  error: {
    color: dark.danger,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: dark.text,
    marginTop: 8,
    marginBottom: 8,
  },
  empty: {
    color: dark.textFaint,
    textAlign: 'center',
    marginTop: 12,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
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
    color: dark.text,
  },
  orderStatus: {
    fontSize: 12,
    color: dark.textMuted,
    marginTop: 2,
  },
  orderPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: dark.textMuted,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  filterChipActive: {
    backgroundColor: dark.accent,
    borderColor: dark.accent,
  },
  filterChipText: {
    color: dark.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#0a0a0a',
  },
  card: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: dark.surfaceElevated,
    borderWidth: 1,
    borderColor: dark.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: dark.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: dark.text,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: dark.accent,
  },
  cardSpecialty: {
    fontSize: 12,
    color: dark.accent,
    fontWeight: '600',
    marginTop: 2,
  },
  cardBio: {
    fontSize: 13,
    color: dark.textMuted,
    marginTop: 10,
    lineHeight: 19,
  },
  buyButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  buyButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
});
