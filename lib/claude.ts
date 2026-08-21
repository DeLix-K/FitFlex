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
  'This photo shows a piece of gym or exercise equipment. Identify what it is, then explain in ' +
  'plain sentences: what it is used for, how to use it safely with correct form, and one common ' +
  'mistake beginners make with it. If the photo does not clearly show exercise equipment, say so ' +
  "plainly instead of guessing. Keep the whole reply under 150 words, no markdown formatting.";

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

export function buildCoachSystemPrompt(plans: { name: string; exerciseNames: string[] }[]): string {
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
    'You are the FitFlex AI Coach, a warm, encouraging, knowledgeable fitness coach inside a workout app. ' +
    "You can see the user's saved workout plans below and should refer to them naturally when relevant " +
    "(e.g. suggesting which saved plan to do today, or noting they haven't built one yet). " +
    "You answer fitness, exercise, and general wellness questions, suggest workouts, and adjust advice for " +
    'things like soreness, tiredness, or limited time when the user mentions them. ' +
    'Keep replies conversational and concise (usually under 120 words unless the user asks for detail), ' +
    'plain sentences, no markdown formatting. You are not a doctor — for medical concerns, suggest they see one.\n\n' +
    `Their saved workout plans:\n${planSummary}`
  );
}

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

export function buildExerciseExplanationPrompt(exercise: {
  name: string;
  category: string;
  muscle_groups: string[];
  equipment: string[];
}): string {
  return (
    `Give a short, encouraging explanation (3-4 sentences) for the exercise "${exercise.name}" ` +
    `(category: ${exercise.category}${
      exercise.equipment.length ? `, equipment: ${exercise.equipment.join(', ')}` : ''
    }). ` +
    `Cover proper form tips, a common mistake to avoid, and why it's worth doing. ` +
    `Write for a beginner. Do not use markdown formatting.`
  );
}
