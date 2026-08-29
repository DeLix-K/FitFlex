import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { WELLNESS_TIPS } from '../lib/wellness';
import { calm } from '../lib/theme';

const CARD_WIDTH = 220;

export default function WellnessTipCarousel() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>💡 Quick Wellness Tips</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + 12}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
      >
        {WELLNESS_TIPS.map((tip, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.emoji}>{tip.emoji}</Text>
            <Text style={styles.text}>{tip.text}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  title: {
    color: calm.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  scrollContent: {
    gap: 12,
    paddingRight: 8,
  },
  card: {
    width: CARD_WIDTH,
    borderWidth: 1,
    borderColor: calm.border,
    backgroundColor: calm.surface,
    borderRadius: 18,
    padding: 16,
  },
  emoji: {
    fontSize: 22,
    marginBottom: 8,
  },
  text: {
    color: calm.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
});
