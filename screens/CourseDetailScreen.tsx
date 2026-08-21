import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  buyCourse,
  fetchCompletedLessonIds,
  fetchCourseLessons,
  markLessonComplete,
  markLessonIncomplete,
} from '../lib/courses';
import { supabase } from '../lib/supabase';
import { dark } from '../lib/theme';
import type { Course, CourseLesson, CourseLessonPreview } from '../lib/types';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CourseDetailScreen({
  courseId,
  onBack,
}: {
  courseId: string;
  onBack: () => void;
}) {
  const [course, setCourse] = useState<Course | null>(null);
  const [previews, setPreviews] = useState<CourseLessonPreview[]>([]);
  const [fullById, setFullById] = useState<Map<string, CourseLesson>>(new Map());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [busyLessonId, setBusyLessonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [courseResult, lessonsResult, completed] = await Promise.all([
        supabase.from('courses').select('*').eq('id', courseId).single(),
        fetchCourseLessons(courseId),
        fetchCompletedLessonIds(),
      ]);
      if (courseResult.error) throw new Error(courseResult.error.message);
      setCourse(courseResult.data);
      setPreviews(lessonsResult.previews);
      setFullById(lessonsResult.fullById);
      setCompletedIds(completed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [courseId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const enrolled = previews.length > 0 && fullById.size === previews.length;
  const completedInCourse = previews.filter((p) => completedIds.has(p.id)).length;
  const allComplete = enrolled && previews.length > 0 && completedInCourse === previews.length;

  const handleBuy = async () => {
    setBuying(true);
    setError(null);
    try {
      await buyCourse(courseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBuying(false);
    }
  };

  const toggleComplete = async (lessonId: string) => {
    setBusyLessonId(lessonId);
    setError(null);
    try {
      if (completedIds.has(lessonId)) await markLessonIncomplete(lessonId);
      else await markLessonComplete(lessonId);
      const completed = await fetchCompletedLessonIds();
      setCompletedIds(completed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyLessonId(null);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>{'< Courses'}</Text>
      </Pressable>

      <Text style={styles.title}>{course?.title}</Text>
      {course?.description ? <Text style={styles.description}>{course.description}</Text> : null}
      {error && <Text style={styles.error}>{error}</Text>}

      {allComplete && (
        <View style={styles.certificate}>
          <Text style={styles.certificateEmoji}>🎓</Text>
          <Text style={styles.certificateTitle}>Certificate of Completion</Text>
          <Text style={styles.certificateText}>
            You've completed every lesson in "{course?.title}". Nice work!
          </Text>
        </View>
      )}

      {!enrolled && course && (
        <Pressable style={styles.buyButton} onPress={handleBuy} disabled={buying}>
          {buying ? (
            <ActivityIndicator color="#0a0a0a" />
          ) : (
            <Text style={styles.buyButtonText}>Buy Course — {formatPrice(course.price_cents)}</Text>
          )}
        </Pressable>
      )}

      <Text style={styles.sectionTitle}>Lessons</Text>

      {previews.map((preview, index) => {
        const full = fullById.get(preview.id);
        const expanded = expandedId === preview.id;
        const done = completedIds.has(preview.id);

        return (
          <View key={preview.id} style={styles.lessonCard}>
            <Pressable
              style={styles.lessonHeader}
              onPress={() => full && setExpandedId(expanded ? null : preview.id)}
              disabled={!full}
            >
              <Text style={styles.lessonNumber}>{index + 1}.</Text>
              <Text style={[styles.lessonTitle, !full && styles.lessonTitleLocked]}>
                {preview.title}
              </Text>
              {!full ? (
                <Text style={styles.lockIcon}>🔒</Text>
              ) : done ? (
                <Text style={styles.doneIcon}>✓</Text>
              ) : null}
            </Pressable>

            {expanded && full && (
              <View style={styles.lessonBody}>
                {full.content ? <Text style={styles.lessonContent}>{full.content}</Text> : null}
                {full.video_url ? (
                  <Pressable onPress={() => Linking.openURL(full.video_url)}>
                    <Text style={styles.videoLink}>▶ Watch video</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={[styles.completeButton, done && styles.completeButtonDone]}
                  onPress={() => toggleComplete(preview.id)}
                  disabled={busyLessonId === preview.id}
                >
                  {busyLessonId === preview.id ? (
                    <ActivityIndicator size="small" color={done ? dark.textMuted : '#0a0a0a'} />
                  ) : (
                    <Text
                      style={[
                        styles.completeButtonText,
                        done && styles.completeButtonTextDone,
                      ]}
                    >
                      {done ? '✓ Completed' : 'Mark Complete'}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: dark.background,
  },
  back: {
    color: dark.accent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: dark.text,
  },
  description: {
    fontSize: 13,
    color: dark.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  error: {
    color: dark.danger,
    marginTop: 12,
  },
  certificate: {
    backgroundColor: dark.surface,
    borderWidth: 1,
    borderColor: dark.accentDark,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  certificateEmoji: {
    fontSize: 32,
  },
  certificateTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
    color: dark.text,
  },
  certificateText: {
    fontSize: 12,
    color: dark.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  buyButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buyButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
    color: dark.text,
  },
  lessonCard: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  lessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 8,
  },
  lessonNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: dark.textFaint,
  },
  lessonTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: dark.text,
  },
  lessonTitleLocked: {
    color: dark.textFaint,
  },
  lockIcon: {
    fontSize: 14,
  },
  doneIcon: {
    color: dark.accent,
    fontWeight: '700',
    fontSize: 16,
  },
  lessonBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  lessonContent: {
    fontSize: 14,
    color: dark.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  videoLink: {
    color: dark.accent,
    fontWeight: '600',
    marginBottom: 12,
  },
  completeButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  completeButtonDone: {
    backgroundColor: dark.surfaceElevated,
  },
  completeButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 13,
  },
  completeButtonTextDone: {
    color: dark.textMuted,
  },
});
