import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import TrainerChatModal from '../components/TrainerChatModal';
import TrainerProfileForm from '../components/TrainerProfileForm';
import { buyTrainerPlan, fetchMyOrdersAsClient, fetchTrainers } from '../lib/trainers';
import { supabase } from '../lib/supabase';
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
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [isTrainer, setIsTrainer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSpecialty, setActiveSpecialty] = useState<string | null>(null);
  const [signupOpen, setSignupOpen] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [chatTarget, setChatTarget] = useState<TrainerProfile | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      setMyUserId(userId);

      const [trainerList, myOrders, profileRow] = await Promise.all([
        fetchTrainers(),
        fetchMyOrdersAsClient(),
        userId
          ? supabase.from('profiles').select('is_trainer').eq('id', userId).single()
          : Promise.resolve({ data: null }),
      ]);
      setTrainers(trainerList);
      setOrders(myOrders);
      setIsTrainer(!!(profileRow as { data: { is_trainer: boolean } | null }).data?.is_trainer);
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
    <>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Trainers</Text>
            <Text style={styles.subtitle}>
              Book a custom workout plan built for you by a real trainer or nutritionist.
            </Text>
            {error && <Text style={styles.error}>{error}</Text>}

            {isTrainer ? (
              <View style={styles.trainerNotice}>
                <Text style={styles.trainerNoticeText}>
                  ✓ You're a trainer — manage your listing, orders, and messages from the Trainer
                  Dashboard tab above.
                </Text>
              </View>
            ) : signupOpen ? (
              <View style={{ marginBottom: 16 }}>
                <TrainerProfileForm
                  existing={null}
                  onCancel={() => setSignupOpen(false)}
                  onSaved={() => {
                    setSignupOpen(false);
                    setSignupDone(true);
                    setIsTrainer(true);
                  }}
                />
              </View>
            ) : (
              <Pressable style={styles.becomeTrainerCard} onPress={() => setSignupOpen(true)}>
                <Text style={styles.becomeTrainerTitle}>Become a Trainer</Text>
                <Text style={styles.becomeTrainerText}>
                  Sign up, fill in your profile, and start selling custom plans to FitFlex members.
                </Text>
                <Text style={styles.becomeTrainerCta}>Get started →</Text>
              </Pressable>
            )}

            {signupDone && (
              <Text style={styles.successNote}>
                ✓ Trainer profile created — open the new Trainer Dashboard tab above to set up
                payouts and start accepting orders.
              </Text>
            )}

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
        renderItem={({ item }) => {
          const isMe = item.user_id === myUserId;
          return (
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

              {isMe ? (
                <View style={styles.ownListingBadge}>
                  <Text style={styles.ownListingText}>This is your listing</Text>
                </View>
              ) : (
                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.bookButton, styles.actionButton]}
                    onPress={() => handleBuy(item.id)}
                    disabled={buyingId === item.id}
                  >
                    {buyingId === item.id ? (
                      <ActivityIndicator color="#0a0a0a" />
                    ) : (
                      <Text style={styles.bookButtonText}>Book This Trainer</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.messageButton, styles.actionButton]}
                    onPress={() => setChatTarget(item)}
                  >
                    <Text style={styles.messageButtonText}>Message</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />

      {chatTarget && myUserId && (
        <TrainerChatModal
          visible={!!chatTarget}
          onClose={() => setChatTarget(null)}
          trainerUserId={chatTarget.user_id}
          clientUserId={myUserId}
          otherPartyLabel={chatTarget.display_name}
        />
      )}
    </>
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
  becomeTrainerCard: {
    borderWidth: 1,
    borderColor: dark.accent,
    backgroundColor: dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  becomeTrainerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: dark.text,
  },
  becomeTrainerText: {
    fontSize: 13,
    color: dark.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  becomeTrainerCta: {
    fontSize: 13,
    color: dark.accent,
    fontWeight: '700',
    marginTop: 10,
  },
  trainerNotice: {
    borderWidth: 1,
    borderColor: dark.accentDark,
    backgroundColor: dark.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  trainerNoticeText: {
    color: dark.text,
    fontSize: 13,
    lineHeight: 18,
  },
  successNote: {
    color: dark.accent,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 16,
    lineHeight: 17,
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
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
  },
  bookButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 13,
  },
  messageButton: {
    borderWidth: 1,
    borderColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  messageButtonText: {
    color: dark.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  ownListingBadge: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  ownListingText: {
    color: dark.textFaint,
    fontSize: 12,
    fontWeight: '600',
  },
});
