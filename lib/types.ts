export type ExerciseCategory = 'home' | 'outdoor' | 'gym';

export type ExerciseFatigueTier = 'low' | 'moderate' | 'high';

export type Exercise = {
  id: string;
  name: string;
  instructions: string;
  benefits: string;
  // Ordered primary-first: muscle_groups[0] is the primary muscle, the
  // rest are secondary/stabilizers. No separate column for this -- see
  // supabase/exercises_overhaul.sql.
  muscle_groups: string[];
  equipment: string[];
  category: ExerciseCategory;
  video_url: string | null;
  created_at: string;
  fatigue_tier: ExerciseFatigueTier | null;
  low_impact: boolean;
  created_by: string | null;
};

export type ExerciseSetLog = {
  id: string;
  user_id: string;
  exercise_id: string;
  logged_date: string;
  weight: number;
  weight_unit: 'kg' | 'lb';
  reps: number;
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

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MealLog = {
  id: string;
  user_id: string;
  log_date: string;
  meal_type: MealType;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: 'manual' | 'scan' | 'search';
  created_at: string;
};

export type PlanScheduleEntry = {
  id: string;
  user_id: string;
  weekday: number;
  plan_id: string | null;
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
  | 'sleep_insight'
  | 'daily_briefing'
  | 'post_workout_insight'
  | 'session_recalibration'
  | 'form_check'
  | 'bedtime_story'
  | 'wellness_recommendation';

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
  duration_minutes: number | null;
  created_at: string;
};

export type StreakFreezeBalance = {
  user_id: string;
  balance: number;
  highest_rewarded_streak: number;
  updated_at: string;
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
  creator_user_id: string | null;
  target_note: string;
  premium_only: boolean;
  hosted_by_trainer_id: string | null;
  created_at: string;
};

export type ChallengeProgress = {
  challenge_id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
  workouts_logged: number;
  effective_target: number;
  shields_used: number;
  commitment: string;
  baseline_workouts_per_week: number;
};

export type ChallengeStage = {
  id: string;
  challenge_id: string;
  order_index: number;
  title: string;
  description: string;
  duration_days: number;
  target_workouts: number;
};

export type ChallengeStageProgress = {
  stage_id: string;
  challenge_id: string;
  order_index: number;
  title: string;
  target_workouts: number;
  stage_start: string;
  stage_end: string;
  user_id: string;
  workouts_logged: number;
};

export type ChallengeTeam = {
  id: string;
  challenge_id: string;
  name: string;
  created_by: string;
  created_at: string;
};

export type ChallengeTeamMember = {
  team_id: string;
  challenge_id: string;
  user_id: string;
  joined_at: string;
};

export type ChallengeTeamProgress = {
  team_id: string;
  challenge_id: string;
  name: string;
  member_count: number;
  total_workouts_logged: number;
  total_shields_used: number;
  total_target: number;
};

export type ChallengeActivityKind = 'joined' | 'logged_day' | 'completed';

export type ChallengeActivity = {
  id: string;
  challenge_id: string;
  user_id: string;
  kind: ChallengeActivityKind;
  created_at: string;
};

export type ChallengeActivityView = ChallengeActivity & {
  display_name: string;
  reactions: { high_five: number; boost: number; myReactions: string[] };
};

export type ChallengeReactionType = 'high_five' | 'boost';

export type ChallengeReaction = {
  id: string;
  activity_id: string;
  from_user_id: string;
  reaction_type: ChallengeReactionType;
  created_at: string;
};

export type ChallengeInviteStatus = 'pending' | 'accepted' | 'declined';

export type ChallengeInvite = {
  id: string;
  challenge_id: string;
  inviter_user_id: string;
  invitee_user_id: string;
  status: ChallengeInviteStatus;
  created_at: string;
};

export type ChallengeInviteView = ChallengeInvite & {
  challenge_title: string;
  inviter_display_name: string;
};

export type TrainerMessage = {
  id: string;
  trainer_user_id: string;
  client_user_id: string;
  sender_id: string;
  body: string;
  created_at: string;
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

export type HabitType = 'boolean' | 'numeric';
export type HabitTimeOfDay = 'morning' | 'midday' | 'evening' | 'anytime';
export type HabitAutoSyncSource = 'sleep_duration' | 'oura_steps' | 'workout_done';
export type HabitTier = 'gold' | 'silver' | 'bronze' | null;

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  habit_type: HabitType;
  target_value: number | null;
  unit: string | null;
  time_of_day: HabitTimeOfDay;
  auto_sync_source: HabitAutoSyncSource | null;
};

export type HabitWithStatus = Habit & {
  current_streak: number;
  done_today: boolean;
  progress_today: number | null;
  tier_today: HabitTier;
  auto_logged_today: boolean;
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

export type DigitalProductCategory =
  | 'workout_guides'
  | 'nutrition_guides'
  | 'training_programmes'
  | 'transformation_plans'
  | 'beginner_guides'
  | 'weight_loss';

export type DigitalProduct = {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  category: DigitalProductCategory;
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
  stress: number | null;
  energy: number | null;
};

export type HydrationLog = {
  id: string;
  user_id: string;
  log_date: string;
  glasses: number;
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
  average_hrv: number | null;
  lowest_heart_rate: number | null;
  sleep_phase_5min: string | null;
};

export type SleepBehaviorTag =
  | 'alcohol'
  | 'late_meal'
  | 'caffeine_late'
  | 'sauna_bath'
  | 'screen_time'
  | 'stressful_day'
  | 'meditated'
  | 'magnesium'
  | 'intense_exercise';

export type SleepBehaviorTagRow = {
  id: string;
  user_id: string;
  sleep_date: string;
  tag: SleepBehaviorTag;
  created_at: string;
};
