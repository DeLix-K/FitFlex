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
import { useCart } from '../lib/cartContext';
import { buyCart, fetchMerchCatalog, fetchMyMerchOrders } from '../lib/merch';
import { dark } from '../lib/theme';
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
  const [error, setError] = useState<string | null>(null);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const cart = useCart();

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

  const handleAddToCart = (product: MerchProduct) => {
    const variantId = selectedVariant[product.id] ?? product.variants.find((v) => v.available)?.syncVariantId;
    const variant = product.variants.find((v) => v.syncVariantId === variantId);
    if (!variant) return;

    cart.addItem({
      productId: product.id,
      syncVariantId: variant.syncVariantId,
      productName: product.name,
      thumbnailUrl: product.thumbnailUrl,
      size: variant.size,
      color: variant.color,
      priceCents: variant.priceCents,
    });
  };

  const handleCheckout = async () => {
    setCheckingOut(true);
    setError(null);
    try {
      await buyCart(cart.items);
      cart.clearCart();
      setCartOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCheckingOut(false);
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

    <Modal visible={cartOpen} animationType="slide" onRequestClose={() => setCartOpen(false)}>
      <View style={styles.cartContainer}>
        <View style={styles.cartHeader}>
          <Text style={styles.cartTitle}>Your Cart</Text>
          <Pressable onPress={() => setCartOpen(false)}>
            <Text style={styles.cartClose}>Close</Text>
          </Pressable>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {cart.items.length === 0 ? (
          <Text style={styles.empty}>Your cart is empty.</Text>
        ) : (
          <FlatList
            data={cart.items}
            keyExtractor={(item) => String(item.syncVariantId)}
            contentContainerStyle={styles.cartList}
            renderItem={({ item }) => (
              <View style={styles.cartRow}>
                {item.thumbnailUrl ? (
                  <Image source={{ uri: item.thumbnailUrl }} style={styles.cartThumbnail} />
                ) : (
                  <View style={styles.thumbnailPlaceholder} />
                )}
                <View style={styles.cartRowInfo}>
                  <Text style={styles.cartRowName}>{item.productName}</Text>
                  <Text style={styles.cartRowVariant}>{item.size} / {item.color}</Text>
                  <Text style={styles.cartRowPrice}>{formatPrice(item.priceCents)} each</Text>
                </View>
                <View style={styles.cartQtyControls}>
                  <Pressable
                    style={styles.cartQtyButton}
                    onPress={() => cart.updateQuantity(item.syncVariantId, item.quantity - 1)}
                  >
                    <Text style={styles.cartQtyButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.cartQtyValue}>{item.quantity}</Text>
                  <Pressable
                    style={styles.cartQtyButton}
                    onPress={() => cart.updateQuantity(item.syncVariantId, item.quantity + 1)}
                  >
                    <Text style={styles.cartQtyButtonText}>+</Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => cart.removeItem(item.syncVariantId)}>
                  <Text style={styles.cartRemove}>Remove</Text>
                </Pressable>
              </View>
            )}
          />
        )}

        {cart.items.length > 0 && (
          <View style={styles.cartFooter}>
            <View style={styles.cartTotalRow}>
              <Text style={styles.cartTotalLabel}>Total</Text>
              <Text style={styles.cartTotalValue}>{formatPrice(cart.totalCents)}</Text>
            </View>
            <Pressable style={styles.buyButton} onPress={handleCheckout} disabled={checkingOut}>
              {checkingOut ? (
                <ActivityIndicator color="#0a0a0a" />
              ) : (
                <Text style={styles.buyButtonText}>Checkout</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </Modal>

    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Merch</Text>
              <Text style={styles.subtitle}>Official FitFlex gear, shipped straight to your door.</Text>
            </View>
            <Pressable style={styles.cartButton} onPress={() => setCartOpen(true)}>
              <Text style={styles.cartButtonText}>🛒 Cart</Text>
              {cart.totalCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cart.totalCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
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
                  onPress={() => handleAddToCart(item)}
                  disabled={!chosenVariant && !item.variants.some((v) => v.available)}
                >
                  <Text style={styles.buyButtonText}>
                    Add to Cart — {formatPrice(chosenVariant?.priceCents ?? item.variants.find((v) => v.available)?.priceCents ?? 0)}
                  </Text>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    maxWidth: 240,
  },
  cartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  cartButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: dark.text,
  },
  cartBadge: {
    marginLeft: 6,
    backgroundColor: dark.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#0a0a0a',
    fontSize: 11,
    fontWeight: '700',
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
    paddingRight: 8,
  },
  orderItem: {
    fontSize: 13,
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
  card: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
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
    backgroundColor: dark.surfaceElevated,
  },
  thumbnailPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: dark.surfaceElevated,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: dark.text,
  },
  cardPrice: {
    fontSize: 13,
    color: dark.accent,
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
    borderColor: dark.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  variantChipSelected: {
    backgroundColor: dark.accent,
    borderColor: dark.accent,
  },
  variantChipDisabled: {
    opacity: 0.4,
  },
  variantChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: dark.text,
  },
  variantChipTextSelected: {
    color: '#0a0a0a',
  },
  buyButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buyButtonText: {
    color: '#0a0a0a',
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
  cartContainer: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: dark.background,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cartTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: dark.text,
  },
  cartClose: {
    color: dark.accent,
    fontWeight: '600',
    fontSize: 15,
  },
  cartList: {
    paddingBottom: 20,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
    paddingVertical: 12,
  },
  cartThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: dark.surfaceElevated,
  },
  cartRowInfo: {
    flex: 1,
  },
  cartRowName: {
    fontSize: 13,
    fontWeight: '700',
    color: dark.text,
  },
  cartRowVariant: {
    fontSize: 12,
    color: dark.textMuted,
    marginTop: 1,
  },
  cartRowPrice: {
    fontSize: 12,
    color: dark.textFaint,
    marginTop: 1,
  },
  cartQtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cartQtyButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartQtyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: dark.text,
  },
  cartQtyValue: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 18,
    textAlign: 'center',
    color: dark.text,
  },
  cartRemove: {
    color: dark.danger,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  cartFooter: {
    borderTopWidth: 1,
    borderTopColor: dark.border,
    paddingTop: 16,
    paddingBottom: 24,
  },
  cartTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cartTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: dark.text,
  },
  cartTotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: dark.accent,
  },
});
