import { supabase } from './supabase';

export type ImageInput = { data: string; mediaType: string };
export type ChatMessage = { role: 'user' | 'assistant'; content: string };

async function invokeAskClaude(body: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ reply?: string; error?: string }>(
    'ask-claude',
    { body }
  );

  if (error) {
    const context = (error as { context?: Response }).context;
    let detailedMessage: string | undefined;
    if (context) {
      try {
        const errorBody = await context.clone().json();
        if (errorBody?.error) detailedMessage = errorBody.error;
      } catch {
        // Response body wasn't JSON or didn't have an "error" field; fall through.
      }
    }
    throw new Error(detailedMessage ?? error.message);
  }

  if (data?.error) throw new Error(data.error);
  return data?.reply ?? '';
}

export async function askClaude(prompt: string, image?: ImageInput): Promise<string> {
  return invokeAskClaude(image ? { prompt, image } : { prompt });
}

export async function askClaudeChat(messages: ChatMessage[], system?: string): Promise<string> {
  return invokeAskClaude(system ? { messages, system } : { messages });
}

export const EQUIPMENT_SCAN_PROMPT =
  'This photo shows a piece of gym or exercise equipment. Identify what it is, then cover each ' +
  'of these briefly in plain sentences: how to use it and correct setup, 2-3 exercises you can ' +
  'do on it, one key safety tip, and a beginner instruction to get started. If the photo does ' +
  'not clearly show exercise equipment, say so plainly instead of guessing. Keep the whole reply ' +
  'under 180 words, no markdown formatting.';

export const FOOD_SCAN_PROMPT =
  'This photo shows a meal or snack. Identify what food(s) you see, then give an estimated ' +
  'calorie, protein, carb, and fat breakdown for a typical portion size shown. If multiple items ' +
  'are visible, break each one down separately, then give a rough total. If the photo does not ' +
  'clearly show food, say so plainly instead of guessing. Note once, briefly, that this is a ' +
  'rough visual estimate, not a precise measurement. Keep the whole reply under 150 words, plain ' +
  'sentences and short lists using "-" for bullets, no markdown headers or bold text.';

export function buildNutritionSearchPrompt(query: string): string {
  return (
    `A user of a fitness app is asking about nutrition: "${query}". ` +
    `If this describes a specific food or meal, give an estimated calorie, protein, carb, and fat breakdown. ` +
    `If this is a request for meal or plan suggestions (e.g. "high protein breakfast", "meal plan for weight loss"), ` +
    `suggest 2-3 concrete options with a rough calorie/macro estimate for each. ` +
    `Keep the whole reply under 150 words, written in plain sentences and short lists using "-" for bullets, ` +
    `no markdown headers or bold text. Remind them estimates are approximate, briefly, only once.`
  );
}

export type CoachPersonality = 'encouraging' | 'strict' | 'data_focused';

export const COACH_PERSONALITIES: { value: CoachPersonality; label: string; blurb: string }[] = [
  { value: 'encouraging', label: 'Encouraging', blurb: 'Warm and upbeat' },
  { value: 'strict', label: 'Strict', blurb: 'Direct and no-nonsense' },
  { value: 'data_focused', label: 'Data-Focused', blurb: 'Analytical, numbers-first' },
];

const PERSONALITY_TONE: Record<CoachPersonality, string> = {
  encouraging:
    'Your tone is warm, upbeat, and encouraging. Celebrate effort and progress, and keep the user motivated ' +
    'even when the news (e.g. a missed day, low sleep) isn\'t great.',
  strict:
    'Your tone is direct, disciplined, and no-nonsense. Be firm but respectful, cut the fluff, and hold the ' +
    'user accountable — call out excuses gently but plainly.',
  data_focused:
    'Your tone is analytical and precise. Lead with the numbers you were given, explain the reasoning behind ' +
    'each recommendation, and keep emotional language to a minimum.',
};

export function buildCoachSystemPrompt(
  plans: { name: string; exerciseNames: string[] }[],
  personality: CoachPersonality = 'encouraging'
): string {
  const planSummary =
    plans.length === 0
      ? "This user hasn't saved any workout plans yet."
      : plans
          .map(
            (p) =>
              `- "${p.name}"${p.exerciseNames.length ? `: ${p.exerciseNames.join(', ')}` : ' (no exercises added yet)'}`
          )
          .join('\n');

  return (
    'You are the FitFlex AI Coach, a knowledgeable fitness coach inside a workout app. ' +
    PERSONALITY_TONE[personality] + '\n\n' +
    "You can see the user's saved workout plans below and should refer to them naturally when relevant " +
    "(e.g. suggesting which saved plan to do today, or noting they haven't built one yet). " +
    "You answer fitness, exercise, and general wellness questions, suggest workouts, and adjust advice for " +
    'things like soreness, tiredness, or limited time when the user mentions them. ' +
    'Keep replies conversational and concise (usually under 120 words unless the user asks for detail), ' +
    'plain sentences, no markdown formatting. You are not a doctor — for medical concerns, suggest they see one.\n\n' +
    `Their saved workout plans:\n${planSummary}`
  );
}

export type DailyBriefingData = {
  sleepHours: number | null;
  sleepScore: number | null;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  currentStreak: number;
  todaysPlanName: string | null;
  hasLoggedToday: boolean;
};

export function buildDailyBriefingPrompt(
  data: DailyBriefingData,
  personality: CoachPersonality = 'encouraging'
): string {
  const facts = [
    data.sleepHours != null
      ? `Slept ${data.sleepHours.toFixed(1)}h last night${data.sleepScore != null ? ` (sleep score ${data.sleepScore}/100)` : ''}.`
      : 'No sleep logged for last night.',
    data.energy != null ? `Energy self-rated ${data.energy}/5 today.` : null,
    data.stress != null ? `Stress self-rated ${data.stress}/5 today.` : null,
    data.mood != null ? `Mood self-rated ${data.mood}/5 today.` : null,
    `Current workout streak: ${data.currentStreak} day(s).`,
    data.todaysPlanName ? `Today's scheduled plan is "${data.todaysPlanName}".` : 'No plan is scheduled for today.',
    data.hasLoggedToday ? 'Already logged a workout today.' : 'Has not logged a workout yet today.',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    'You are the FitFlex AI Coach writing a short "Daily Briefing" for a user, using ONLY the real data given ' +
    `below — never invent numbers, scores, or claims this data doesn't support. ${PERSONALITY_TONE[personality]}\n\n` +
    `Today's real data: ${facts}\n\n` +
    "Write 2-4 sentences: acknowledge what the data actually shows (e.g. low sleep, good energy), and give one " +
    "concrete, specific adjustment for today's training or recovery based on it. If a plan is scheduled, " +
    'reference it by name. If there truly isn\'t enough data to say anything meaningful, say so honestly instead ' +
    'of inventing a pattern. No markdown, no headers, plain conversational sentences, under 100 words.'
  );
}

export type PostWorkoutInsightData = {
  currentStreak: number;
  thisWeekCount: number;
  lastWeekCount: number;
  totalWorkouts: number;
  recentSleepAvgHours: number | null;
};

export function buildPostWorkoutInsightPrompt(
  data: PostWorkoutInsightData,
  personality: CoachPersonality = 'encouraging'
): string {
  const facts =
    `Just logged a workout. Current streak: ${data.currentStreak} day(s). Total workouts logged all-time: ` +
    `${data.totalWorkouts}. Workouts this week (including today): ${data.thisWeekCount}. Workouts last week: ` +
    `${data.lastWeekCount}.` +
    (data.recentSleepAvgHours != null
      ? ` Average sleep over the last several logged nights: ${data.recentSleepAvgHours.toFixed(1)}h.`
      : ' No recent sleep data logged.');

  return (
    'You are the FitFlex AI Coach writing a short post-workout insight right after a user logs a session, using ' +
    `ONLY the real data given below — never invent an exercise, weight, or plateau claim this data doesn't ` +
    `support. ${PERSONALITY_TONE[personality]}\n\n` +
    `Real data: ${facts}\n\n` +
    'Write 2-3 sentences: note a genuine trend in this data (e.g. more consistent than last week, streak ' +
    'building, or sleep possibly affecting training) and one concrete, practical suggestion for what to focus on ' +
    "next. If the data doesn't support a real trend yet, say so honestly and encourage continued logging instead " +
    'of inventing one. No markdown, plain conversational sentences, under 80 words.'
  );
}

export function buildSessionRecalibrationPrompt(params: {
  planName: string | null;
  exerciseNames: string[];
  soreness: string;
  timeAvailable: string;
  equipment: string;
  energyLevel: number;
  personality?: CoachPersonality;
}): string {
  const personality = params.personality ?? 'encouraging';
  const planLine = params.planName
    ? `Today's scheduled plan is "${params.planName}"${
        params.exerciseNames.length ? ` with exercises: ${params.exerciseNames.join(', ')}` : ' (no exercises added yet)'
      }.`
    : 'No specific plan is scheduled for today — suggest a sensible session from scratch.';

  return (
    'You are the FitFlex AI Coach. A user wants their session recalibrated right now based on how they actually ' +
    `feel today. ${PERSONALITY_TONE[personality]}\n\n` +
    `${planLine}\n` +
    `Soreness/limitations: ${params.soreness || 'none mentioned'}.\n` +
    `Time available: ${params.timeAvailable}.\n` +
    `Equipment available: ${params.equipment}.\n` +
    `Self-rated energy: ${params.energyLevel}/5.\n\n` +
    "Rewrite today's session to fit these real constraints: adjust or swap specific exercises, and adjust total " +
    'volume/intensity for the time and energy given. Be specific (exercise names, roughly how many sets), not ' +
    'generic. Keep it practical and realistic for the equipment available. No markdown formatting, plain ' +
    'sentences and short lists using "-" for bullets, under 180 words.'
  );
}

export const FORM_CHECK_PROMPT =
  'This photo shows someone performing a resistance-training exercise mid-rep. Identify the exercise if you ' +
  'can, then give feedback on visible form cues only (e.g. knee alignment/cave, back/spine position, bar path, ' +
  'squat/hinge depth, foot positioning) — only comment on what is actually visible in this single frame, do not ' +
  'guess at the full rep or invent issues you cannot see. Note 1-2 things done well and 1-2 specific things to ' +
  'adjust, in plain sentences. If the photo does not clearly show a person mid-exercise, say so plainly instead ' +
  'of guessing. Remind them once, briefly, that a single photo cannot capture the full movement — for a fuller ' +
  'picture, submitting photos from a couple of points in the rep helps. Keep the whole reply under 170 words, ' +
  'no markdown formatting.';

export function buildWellnessReflectionPrompt(mood: number, notes: string): string {
  const moodLabel = ['very low', 'low', 'okay', 'good', 'great'][mood - 1] ?? 'okay';
  return (
    `You are a warm, supportive wellness companion inside a fitness app, not a therapist. ` +
    `A user just logged their mood as "${moodLabel}" (${mood}/5)` +
    (notes.trim() ? ` and wrote this note: "${notes.trim()}"` : ' with no additional notes') +
    `. Write a short, validating reflection (3-5 sentences): acknowledge how they're feeling ` +
    `without judgment, and if it fits naturally, offer one gentle, practical suggestion ` +
    '(e.g. a short walk, a breathing exercise, journaling, reaching out to someone). ' +
    'Keep the tone conversational and warm, no markdown formatting. This is not medical advice ' +
    'and you are not a therapist — if anything suggests they may be in crisis or need real ' +
    'support, gently and briefly encourage them to reach out to a mental health professional ' +
    'or a crisis line, without being alarmist.'
  );
}

export function buildWellnessRecommendationPrompt(params: {
  wellnessScore: number | null;
  mood: number | null;
  stress: number | null;
  energy: number | null;
  recoveryScore: number | null;
  sleepHours: number | null;
}): string {
  const parts: string[] = [];
  if (params.wellnessScore != null) parts.push(`overall wellness score ${params.wellnessScore}/100`);
  if (params.mood != null) parts.push(`mood ${params.mood}/5`);
  if (params.stress != null) parts.push(`stress ${params.stress}/5`);
  if (params.energy != null) parts.push(`energy ${params.energy}/5`);
  if (params.recoveryScore != null) parts.push(`Oura recovery score ${params.recoveryScore}/100`);
  if (params.sleepHours != null) parts.push(`${params.sleepHours.toFixed(1)}h sleep last night`);
  const signals = parts.length > 0 ? parts.join(', ') : 'no check-in data yet today';

  return (
    `You are a warm, practical wellness companion inside a fitness app, not a therapist or doctor. ` +
    `Today's real signals for this user: ${signals}. Write a short, personalized recommendation ` +
    '(3-4 sentences) for how to approach today: whether to push physical training or prioritize ' +
    'recovery, and one concrete wellness action (breathwork, hydration, a short walk, an early ' +
    'night, etc). Base it only on the real signals given — if a signal is missing, do not guess ' +
    'or invent it. No markdown, plain conversational sentences. This is not medical advice.'
  );
}

export function buildSleepInsightPrompt(
  nights: { date: string; durationMinutes: number | null; bedtime: string | null; score: number | null }[]
): string {
  const lines = nights
    .map((n) => {
      const hours = n.durationMinutes != null ? `${(n.durationMinutes / 60).toFixed(1)}h` : 'no duration logged';
      const bedtimeStr = n.bedtime
        ? new Date(n.bedtime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
        : 'unknown bedtime';
      const scoreStr = n.score != null ? `, score ${n.score}` : '';
      return `${n.date}: ${hours}, bedtime ${bedtimeStr}${scoreStr}`;
    })
    .join('\n');

  return (
    `You are a sleep and recovery coach inside a fitness app. Here is a user's sleep log for ` +
    `the last several nights (most recent last):\n${lines}\n\n` +
    'Write a short, specific insight (2-4 sentences): note any real pattern you can see in this ' +
    'data (e.g. a link between bedtime and duration, or a trend), and give one concrete, ' +
    'actionable suggestion. If there is not enough data for a real pattern, say so honestly ' +
    'instead of inventing one, and suggest logging a few more nights. No markdown, no headers, ' +
    'plain conversational sentences.'
  );
}

export function buildBedtimeStoryPrompt(theme: string): string {
  return (
    `Write a short, calming bedtime story for an adult winding down for sleep. Theme: ${theme || 'a peaceful, gentle scene'}. ` +
    'Keep it 150-220 words, slow-paced, soothing, present tense, second person or gentle narration -- no ' +
    'suspense, conflict, or plot tension of any kind. Plain prose only, no markdown, no headers, no title line.'
  );
}

export function buildExerciseExplanationPrompt(exercise: {
  name: string;
  category: string;
  muscle_groups: string[];
  equipment: string[];
}): string {
  return (
    `Give a short, encouraging explanation for the exercise "${exercise.name}" ` +
    `(category: ${exercise.category}${
      exercise.equipment.length ? `, equipment: ${exercise.equipment.join(', ')}` : ''
    }). ` +
    'Cover, in a few sentences each: proper form tips, a suggested sets/reps range for a ' +
    "beginner, the single most common mistake to avoid, and why it's worth doing. " +
    'Write for a beginner. Do not use markdown formatting, just plain sentences/paragraphs.'
  );
}

export function buildFormGuardrailsPrompt(exercise: { name: string; muscle_groups: string[] }): string {
  return (
    `For the exercise "${exercise.name}" (targets: ${exercise.muscle_groups.join(', ')}), give exactly ` +
    '3 short "do" form cues and exactly 3 short "don\'t" mistakes to avoid. Respond in EXACTLY this ' +
    'format, one per line, no extra text before/after, no markdown:\n' +
    'DO: <cue 1>\nDO: <cue 2>\nDO: <cue 3>\nDONT: <mistake 1>\nDONT: <mistake 2>\nDONT: <mistake 3>\n' +
    'Each line under 12 words.'
  );
}

export function parseFormGuardrails(text: string): { dos: string[]; donts: string[] } {
  const dos: string[] = [];
  const donts: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase().startsWith('DO:')) dos.push(trimmed.slice(3).trim());
    else if (trimmed.toUpperCase().startsWith("DONT:")) donts.push(trimmed.slice(5).trim());
  }
  return { dos, donts };
}

export function buildMindMuscleCuePrompt(exercise: { name: string; muscle_groups: string[] }): string {
  const primary = exercise.muscle_groups[0] ?? 'the target muscle';
  return (
    `In ONE short sentence (under 20 words), give a mind-muscle-connection cue for "${exercise.name}" ` +
    `focused on feeling it in the ${primary}. Plain spoken sentence, no markdown, no preamble.`
  );
}
