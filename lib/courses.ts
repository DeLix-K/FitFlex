import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';
import type { Course, CourseLesson, CourseLessonPreview, CourseWithStatus } from './types';

async function invoke<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>(name, {
    body: body ?? {},
  });

  if (error) {
    const context = (error as { context?: Response }).context;
    let detailedMessage: string | undefined;
    if (context) {
      try {
        const errorBody = await context.clone().json();
        if (errorBody?.error) detailedMessage = errorBody.error;
      } catch {
        // fall through
      }
    }
    throw new Error(detailedMessage ?? error.message);
  }

  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function fetchCourses(): Promise<CourseWithStatus[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const [coursesResult, previewsResult, enrollmentsResult, progressResult] = await Promise.all([
    supabase.from('courses').select('*').order('created_at', { ascending: true }),
    supabase.from('course_lesson_previews').select('*'),
    userId
      ? supabase.from('course_enrollments').select('course_id, status').eq('user_id', userId)
      : Promise.resolve({ data: [], error: null }),
    userId
      ? supabase.from('course_lesson_progress').select('lesson_id').eq('user_id', userId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (coursesResult.error) throw new Error(coursesResult.error.message);
  if (previewsResult.error) throw new Error(previewsResult.error.message);

  const previews = (previewsResult.data ?? []) as CourseLessonPreview[];
  const lessonCountByCourse = new Map<string, number>();
  const courseIdByLesson = new Map<string, string>();
  for (const lesson of previews) {
    lessonCountByCourse.set(lesson.course_id, (lessonCountByCourse.get(lesson.course_id) ?? 0) + 1);
    courseIdByLesson.set(lesson.id, lesson.course_id);
  }

  const enrolledCourseIds = new Set(
    (enrollmentsResult.data ?? [])
      .filter((e: { status: string }) => e.status === 'paid')
      .map((e: { course_id: string }) => e.course_id)
  );

  const completedCountByCourse = new Map<string, number>();
  for (const row of (progressResult.data ?? []) as { lesson_id: string }[]) {
    const courseId = courseIdByLesson.get(row.lesson_id);
    if (!courseId) continue;
    completedCountByCourse.set(courseId, (completedCountByCourse.get(courseId) ?? 0) + 1);
  }

  return ((coursesResult.data ?? []) as Course[]).map((course) => ({
    ...course,
    enrolled: enrolledCourseIds.has(course.id),
    lessonCount: lessonCountByCourse.get(course.id) ?? 0,
    completedCount: completedCountByCourse.get(course.id) ?? 0,
  }));
}

export async function fetchCourseLessons(
  courseId: string
): Promise<{ previews: CourseLessonPreview[]; fullById: Map<string, CourseLesson> }> {
  const [previewsResult, fullResult] = await Promise.all([
    supabase
      .from('course_lesson_previews')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true }),
    supabase.from('course_lessons').select('*').eq('course_id', courseId),
  ]);

  if (previewsResult.error) throw new Error(previewsResult.error.message);

  const fullById = new Map<string, CourseLesson>();
  for (const lesson of (fullResult.data ?? []) as CourseLesson[]) fullById.set(lesson.id, lesson);

  return { previews: (previewsResult.data ?? []) as CourseLessonPreview[], fullById };
}

export async function fetchCompletedLessonIds(): Promise<Set<string>> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from('course_lesson_progress')
    .select('lesson_id')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.lesson_id));
}

export async function markLessonComplete(lessonId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase
    .from('course_lesson_progress')
    .upsert(
      { user_id: userId, lesson_id: lessonId },
      { onConflict: 'user_id,lesson_id', ignoreDuplicates: true }
    );

  if (error) throw new Error(error.message);
}

export async function markLessonIncomplete(lessonId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase
    .from('course_lesson_progress')
    .delete()
    .eq('user_id', userId)
    .eq('lesson_id', lessonId);

  if (error) throw new Error(error.message);
}

export async function buyCourse(courseId: string): Promise<void> {
  const returnUrl = Platform.OS === 'web' ? window.location.href : undefined;

  const { url } = await invoke<{ url?: string }>('create-course-checkout', {
    courseId,
    successUrl: returnUrl,
    cancelUrl: returnUrl,
  });

  if (!url) throw new Error('Stripe did not return a checkout URL.');

  if (Platform.OS === 'web') {
    window.location.href = url;
  } else {
    await Linking.openURL(url);
  }
}
