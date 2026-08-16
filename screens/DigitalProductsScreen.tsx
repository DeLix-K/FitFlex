import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  buyDigitalProduct,
  fetchDigitalProductContent,
  fetchDigitalProducts,
} from '../lib/digitalProducts';
import { colors } from '../lib/theme';
import type { DigitalProductContent, DigitalProductWithStatus } from '../lib/types';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function DigitalProductsScreen() {
  const [products, setProducts] = useState<DigitalProductWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [content, setContent] = useState<Record<string, DigitalProductContent | null>>({});
  const [contentLoading, setContentLoading] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setProducts(await fetchDigitalProducts());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const toggleExpand = async (product: DigitalProductWithStatus) => {
    if (expandedId === product.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(product.id);
    if (product.owned && content[product.id] === undefined) {
      setContentLoading(true);
      try {
        const c = await fetchDigitalProductContent(product.id);
        setContent((prev) => ({ ...prev, [product.id]: c }));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setContentLoading(false);
      }
    }
  };

  const handleBuy = async (productId: string) => {
    setBuyingId(productId);
    setError(null);
    try {
      await buyDigitalProduct(productId);
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
          <Text style={styles.title}>Guides & Plans</Text>
          <Text style={styles.subtitle}>
            One-time downloads: meal plans, transformation programs, and training guides.
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}
        </>
      }
      data={products}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<Text style={styles.empty}>Nothing available yet — check back soon.</Text>}
      renderItem={({ item }) => {
        const expanded = expandedId === item.id;
        const productContent = content[item.id];

        return (
          <View style={styles.card}>
            <Pressable onPress={() => toggleExpand(item)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {!item.owned && <Text style={styles.cardPrice}>{formatPrice(item.price_cents)}</Text>}
              </View>
              {item.description ? <Text style={styles.cardDescription}>{item.description}</Text> : null}
            </Pressable>

            {!item.owned ? (
              <Pressable
                style={styles.buyButton}
                onPress={() => handleBuy(item.id)}
                disabled={buyingId === item.id}
              >
                {buyingId === item.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buyButtonText}>Buy — {formatPrice(item.price_cents)}</Text>
                )}
              </Pressable>
            ) : expanded ? (
              contentLoading ? (
                <ActivityIndicator style={{ marginTop: 12 }} />
              ) : (
                <View style={styles.contentBox}>
                  {productContent?.body ? (
                    <Text style={styles.contentText}>{productContent.body}</Text>
                  ) : null}
                  {productContent?.file_url ? (
                    <Pressable onPress={() => Linking.openURL(productContent.file_url)}>
                      <Text style={styles.fileLink}>⬇ Download</Text>
                    </Pressable>
                  ) : null}
                </View>
              )
            ) : (
              <Pressable onPress={() => toggleExpand(item)}>
                <Text style={styles.ownedHint}>✓ Owned — tap to view</Text>
              </Pressable>
            )}
          </View>
        );
      }}
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
  empty: {
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 12,
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  cardDescription: {
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
  ownedHint: {
    color: colors.success,
    fontWeight: '600',
    fontSize: 12,
    marginTop: 10,
  },
  contentBox: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  contentText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  fileLink: {
    color: colors.primary,
    fontWeight: '600',
    marginTop: 10,
  },
});
