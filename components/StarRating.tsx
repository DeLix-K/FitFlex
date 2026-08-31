import { StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';

export default function StarRating({
  rating,
  reviewCount,
  size = 13,
}: {
  rating: number | null;
  reviewCount: number;
  size?: number;
}) {
  if (rating == null || reviewCount === 0) {
    return <Text style={[styles.noReviews, { fontSize: size }]}>No reviews yet</Text>;
  }
  return (
    <View style={styles.row}>
      <Text style={[styles.stars, { fontSize: size }]}>★ {rating.toFixed(1)}</Text>
      <Text style={[styles.count, { fontSize: size - 1 }]}>({reviewCount} review{reviewCount === 1 ? '' : 's'})</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stars: {
    color: '#fbbf24',
    fontWeight: '700',
  },
  count: {
    color: dark.textFaint,
  },
  noReviews: {
    color: dark.textFaint,
    fontStyle: 'italic',
  },
});
