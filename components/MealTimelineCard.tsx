import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { dietQualityTags } from '../lib/nutrition';
import { dark } from '../lib/theme';
import type { MealLog } from '../lib/types';

const SOURCE_LABEL: Record<MealLog['source'], string> = {
  manual: '',
  scan: '📸 AI estimate',
  search: '🔍 Database match',
  voice: '🎙️ Voice log',
  barcode: '📱 Barcode match',
};

export default function MealTimelineCard({ meal, onRemove }: { meal: MealLog; onRemove: () => void }) {
  const tags = dietQualityTags(meal);
  const sourceLabel = SOURCE_LABEL[meal.source];

  return (
    <View style={styles.card}>
      {meal.photo_url ? (
        <Image source={{ uri: meal.photo_url }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={styles.photoFallback}>
          <Text style={styles.photoFallbackIcon}>🍽️</Text>
        </View>
      )}

      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={2}>
            {meal.description}
          </Text>
          <Pressable onPress={onRemove} hitSlop={8}>
            <Text style={styles.remove}>✕</Text>
          </Pressable>
        </View>

        <Text style={styles.macros}>
          {meal.calories} kcal · P{Math.round(Number(meal.protein_g))}g C{Math.round(Number(meal.carbs_g))}g F
          {Math.round(Number(meal.fat_g))}g
        </Text>

        {(tags.length > 0 || sourceLabel) && (
          <View style={styles.tagRow}>
            {tags.map((t) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
            {sourceLabel ? <Text style={styles.sourceLabel}>{sourceLabel}</Text> : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    gap: 12,
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: dark.surfaceElevated,
  },
  photoFallback: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: dark.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFallbackIcon: {
    fontSize: 24,
  },
  info: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  name: {
    color: dark.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  remove: {
    color: dark.textFaint,
    fontSize: 14,
    fontWeight: '700',
  },
  macros: {
    color: dark.textMuted,
    fontSize: 12,
    marginTop: 3,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    alignItems: 'center',
  },
  tag: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  tagText: {
    color: dark.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  sourceLabel: {
    color: dark.textFaint,
    fontSize: 10,
    fontStyle: 'italic',
  },
});
