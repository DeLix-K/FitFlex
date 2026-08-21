export type ExerciseCategory = 'home' | 'outdoor' | 'gym';

export type Exercise = {
  id: string;
  name: string;
  instructions: string;
  benefits: string;
  muscle_groups: string[];
  equipment: string[];
  category: ExerciseCategory;
  video_url: string | null;
  created_at: string;
};

export type WorkoutPlan = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkoutPlanExercise = {
  id: string;
  workout_plan_id: string;
  exercise_id: string;
  order_index: number;
  sets: number | null;
  reps: number | null;
  notes: string | null;
  exercises: Pick<Exercise, 'id' | 'name' | 'category'>;
};

export type AiHistoryKind =
  | 'equipment_scan'
  | 'food_scan'
  | 'nutrition_search'
  | 'exercise_explanation'
  | 'coach_chat'
  | 'mood_reflection'
  | 'sleep_insight';

export type AiHistoryEntry = {
  id: string;
  user_id: string;
  kind: AiHistoryKind;
  query: string | null;
  result: string;
  created_at: string;
};

export type WorkoutLog = {
  id: string;
  user_id: string;
  logged_date: string;
  workout_plan_id: string | null;
  created_at: string;
};

export type LeaderboardEntry = {
  user_id: string;
  display_name: string;
  current_streak: number;
  total_workouts: number;
  longest_streak: number;
};

export type Challenge = {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  target_workouts: number;
  created_at: string;
};

export type ChallengeProgress = {
  challenge_id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
  workouts_logged: number;
};

export type TrainerProfile = {
  id: string;
  user_id: string;
  display_name: string;
  bio: string;
  specialty: string;
  price_cents: number;
  stripe_account_id: string | null;
  payouts_enabled: boolean;
  created_at: string;
};

export type TrainerOrderStatus = 'pending' | 'paid' | 'fulfilled' | 'refunded';

export type TrainerOrderView = {
  id: string;
  client_user_id: string;
  trainer_user_id: string;
  trainer_profile_id: string;
  amount_cents: number;
  status: TrainerOrderStatus;
  workout_plan_id: string | null;
  created_at: string;
  fulfilled_at: string | null;
  trainer_display_name: string;
  trainer_specialty: string;
  client_display_name: string;
};

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type HabitWithStatus = Habit & {
  current_streak: number;
  done_today: boolean;
};

export type Course = {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  created_at: string;
};

export type CourseWithStatus = Course & {
  enrolled: boolean;
  lessonCount: number;
  completedCount: number;
};

export type CourseLessonPreview = {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
};

export type CourseLesson = {
  id: string;
  course_id: string;
  title: string;
  content: string;
  video_url: string;
  order_index: number;
  created_at: string;
};

export type DigitalProduct = {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  created_at: string;
};

export type DigitalProductWithStatus = DigitalProduct & { owned: boolean };

export type DigitalProductContent = {
  product_id: string;
  body: string;
  file_url: string;
};

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'gain';

export type BodyStats = {
  height_cm: number | null;
  weight_kg: number | null;
  age: number | null;
  sex: Sex | null;
  activity_level: ActivityLevel | null;
  goal: Goal | null;
};

export type MoodLog = {
  id: string;
  user_id: string;
  log_date: string;
  mood: number;
  notes: string;
  ai_reflection: string | null;
  created_at: string;
  updated_at: string;
};

export type MerchVariant = {
  syncVariantId: number;
  name: string;
  size: string;
  color: string;
  priceCents: number;
  currency: string;
  available: boolean;
};

export type MerchProduct = {
  id: number;
  name: string;
  thumbnailUrl: string;
  variants: MerchVariant[];
};

export type MerchOrderStatus = 'pending_payment' | 'paid' | 'submitted' | 'fulfilled' | 'failed';

export type MerchOrder = {
  id: string;
  user_id: string;
  status: MerchOrderStatus;
  items: { syncVariantId: number; name: string; size: string; color: string; quantity: number; priceCents: number }[];
  amount_cents: number;
  created_at: string;
};

export type CartItem = {
  productId: number;
  syncVariantId: number;
  productName: string;
  thumbnailUrl: string;
  size: string;
  color: string;
  priceCents: number;
  quantity: number;
};

export type SleepSource = 'manual' | 'oura';

export type SleepLog = {
  id: string;
  user_id: string;
  sleep_date: string;
  duration_minutes: number | null;
  bedtime: string | null;
  wake_time: string | null;
  quality_rating: number | null;
  sleep_score: number | null;
  notes: string;
  source: SleepSource;
  created_at: string;
  updated_at: string;
  deep_minutes: number | null;
  rem_minutes: number | null;
  light_minutes: number | null;
  awake_minutes: number | null;
};
