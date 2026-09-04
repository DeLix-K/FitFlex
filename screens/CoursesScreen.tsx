import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchCourses } from '../lib/courses';
import { dark } from '../lib/theme';
import type { CourseWithStatus } from '../lib/types';
import CourseDetailScreen from './CourseDetailScreen';

type Mode = { mode: 'list' } | { mode: 'detail'; courseId: string };

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Real photos (Pexels License, free for commercial use, no attribution
// required) -- matched by keyword since courses are admin-authored/DB-driven,
// not a fixed list. Falls back to the strength photo for anything that
// doesn't match a more specific keyword, rather than showing no image.
const COURSE_IMAGES = {
  nutrition: require('../assets/photos/course_nutrition.jpg'),
  hiit: require('../assets/photos/course_hiit.jpg'),
  strength: require('../assets/photos/course_strength.jpg'),
} as const;

function pickCourseImage(title: string) {
  const t = title.toLowerCase();
  if (/nutrition|macro|meal|diet/.test(t)) return COURSE_IMAGES.nutrition;
  if (/hiit|hypertrophy|toning|transformation|cardio|bodyweight/.test(t)) return COURSE_IMAGES.hiit;
  return COURSE_IMAGES.strength;
}

export default function CoursesScreen() {
  const [view, setView] = useState<Mode>({ mode: 'list' });
  const [courses, setCourses] = useState<CourseWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCourses(await fetchCourses());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (view.mode !== 'list') return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [view.mode, load]);

  if (view.mode === 'detail') {
    return (
      <CourseDetailScreen courseId={view.courseId} onBack={() => setView({ mode: 'list' })} />
    );
  }

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
          <Text style={styles.title}>Courses</Text>
          <Text style={styles.subtitle}>Structured courses to level up your training.</Text>
          {error && <Text style={styles.error}>{error}</Text>}
        </>
      }
      data={courses}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <Text style={styles.empty}>No courses available yet — check back soon.</Text>
      }
      renderItem={({ item }) => {
        const pct = item.lessonCount > 0 ? item.completedCount / item.lessonCount : 0;
        return (
          <Pressable style={styles.card} onPress={() => setView({ mode: 'detail', courseId: item.id })}>
            <Image source={pickCourseImage(item.title)} style={styles.cardImage} resizeMode="cover" />
            <View style={styles.cardBody}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {!item.enrolled && <Text style={styles.cardPrice}>{formatPrice(item.price_cents)}</Text>}
            </View>
            {item.description ? <Text style={styles.cardDescription}>{item.description}</Text> : null}
            <Text style={styles.cardMeta}>
              {item.lessonCount} {item.lessonCount === 1 ? 'lesson' : 'lessons'}
            </Text>

            {item.enrolled ? (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {item.completedCount}/{item.lessonCount} complete
                </Text>
              </View>
            ) : (
              <Text style={styles.buyHint}>Tap to view syllabus & buy →</Text>
            )}
            </View>
          </Pressable>
        );
      }}
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
  },
  error: {
    color: dark.danger,
    marginBottom: 12,
  },
  empty: {
    color: dark.textFaint,
    textAlign: 'center',
    marginTop: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  cardImage: {
    width: '100%',
    height: 140,
    backgroundColor: dark.surfaceElevated,
  },
  cardBody: {
    padding: 16,
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
    color: dark.text,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: dark.accent,
  },
  cardDescription: {
    fontSize: 13,
    color: dark.textMuted,
    marginTop: 6,
  },
  cardMeta: {
    fontSize: 12,
    color: dark.textFaint,
    marginTop: 6,
  },
  buyHint: {
    fontSize: 12,
    color: dark.accent,
    fontWeight: '600',
    marginTop: 10,
  },
  progressWrap: {
    marginTop: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: dark.surfaceElevated,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: dark.accent,
  },
  progressText: {
    fontSize: 12,
    color: dark.textMuted,
    marginTop: 4,
    fontWeight: '600',
  },
});
