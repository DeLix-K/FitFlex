import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { buyMerch, fetchMerchCatalog, fetchMyMerchOrders } from '../lib/merch';
import { colors } from '../lib/theme';
import type { MerchOrder, MerchProduct } from '../lib/types';

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  paid: 'Payment received',
  submitted: 'Sent to production',
  fulfilled: 'Shipped',
  failed: 'Something went wrong — we\'ll follow up',
};

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function priceRange(product: MerchProduct): string {
  const available = product.variants.filter((v) => v.available);
  if (available.length === 0) return '';
  const prices = available.map((v) => v.priceCents);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`;
}

export default function MerchScreen() {
  const [products, setProducts] = useState<MerchProduct[]>([]);
  const [orders, setOrders] = useState<MerchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Record<number, number>>({});
  const [buyingVariantId, setBuyingVariantId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [catalog, myOrders] = await Promise.all([fetchMerchCatalog(), fetchMyMerchOrders()]);
      setProducts(catalog);
      setOrders(myOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleBuy = async (product: MerchProduct) => {
    const variantId = selectedVariant[product.id] ?? product.variants.find((v) => v.available)?.syncVariantId;
    if (!variantId) return;

    setBuyingVariantId(variantId);
    setError(null);
    try {
      await buyMerch(product.id, variantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBuyingVariantId(null);
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
    <>
    <Modal
      visible={!!viewingImageUrl}
      transparent
      animationType="fade"
      onRequestClose={() => setViewingImageUrl(null)}
    >
      <Pressable style={styles.imageModalBackdrop} onPress={() => setViewingImageUrl(null)}>
        {viewingImageUrl && (
          <Image source={{ uri: viewingImageUrl }} style={styles.imageModalPhoto} resizeMode="contain" />
        )}
      </Pressable>
    </Modal>
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Merch</Text>
          <Text style={styles.subtitle}>Official FitFlex gear, shipped straight to your door.</Text>
          {error && <Text style={styles.error}>{error}</Text>}

          {orders.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>My Orders</Text>
              {orders.map((order) => (
                <View key={order.id} style={styles.orderRow}>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderItem}>
                      {order.items.map((i) => i.name).join(', ')}
                    </Text>
                    <Text style={styles.orderStatus}>{STATUS_LABEL[order.status] ?? order.status}</Text>
                  </View>
                  <Text style={styles.orderPrice}>{formatPrice(order.amount_cents)}</Text>
                </View>
              ))}
            </>
          )}

          <Text style={styles.sectionTitle}>Shop</Text>
        </>
      }
      data={products}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={<Text style={styles.empty}>No merch available yet — check back soon.</Text>}
      renderItem={({ item }) => {
        const expanded = expandedId === item.id;
        const chosenVariantId = selectedVariant[item.id];
        const chosenVariant = item.variants.find((v) => v.syncVariantId === chosenVariantId);

        return (
          <View style={styles.card}>
            <Pressable
              style={styles.cardTop}
              onPress={() => setExpandedId(expanded ? null : item.id)}
            >
              {item.thumbnailUrl ? (
                <Pressable onPress={() => setViewingImageUrl(item.thumbnailUrl)}>
                  <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
                </Pressable>
              ) : (
                <View style={styles.thumbnailPlaceholder} />
              )}
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardPrice}>{priceRange(item)}</Text>
              </View>
            </Pressable>

            {expanded && (
              <View style={styles.variantSection}>
                <View style={styles.variantRow}>
                  {item.variants.map((variant) => (
                    <Pressable
                      key={variant.syncVariantId}
                      style={[
                        styles.variantChip,
                        chosenVariantId === variant.syncVariantId && styles.variantChipSelected,
                        !variant.available && styles.variantChipDisabled,
                      ]}
                      onPress={() =>
                        variant.available &&
                        setSelectedVariant((s) => ({ ...s, [item.id]: variant.syncVariantId }))
                      }
                      disabled={!variant.available}
                    >
                      <Text
                        style={[
                          styles.variantChipText,
                          chosenVariantId === variant.syncVariantId && styles.variantChipTextSelected,
                        ]}
                      >
                        {variant.size} / {variant.color}
                        {!variant.available ? ' (sold out)' : ''}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  style={styles.buyButton}
                  onPress={() => handleBuy(item)}
                  disabled={buyingVariantId != null || (!chosenVariant && !item.variants.some((v) => v.available))}
                >
                  {buyingVariantId != null ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buyButtonText}>
                      Buy — {formatPrice(chosenVariant?.priceCents ?? item.variants.find((v) => v.available)?.priceCents ?? 0)}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        );
      }}
    />
    </>
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
    paddingRight: 8,
  },
  orderItem: {
    fontSize: 13,
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
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.backgroundMuted,
  },
  thumbnailPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.backgroundMuted,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardPrice: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  variantSection: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  variantRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  variantChip: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  variantChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  variantChipDisabled: {
    opacity: 0.4,
  },
  variantChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  variantChipTextSelected: {
    color: '#fff',
  },
  buyButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buyButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalPhoto: {
    width: '100%',
    height: '80%',
  },
});
