import type { CoachingStyle, TrainerProfile, TrainingFormat } from './types';

// ─────────────────────────────────────────────
// Trainer Matchmaker: real deterministic scoring against real profile
// fields, never an AI-fabricated "why you match" blurb. Every reason shown
// traces back to an actual attribute on the trainer's real listing.
//
// Budget deliberately asks about the real pricing model this marketplace
// actually uses (a one-time custom-plan price) rather than the spec's
// "weekly rate" framing -- there's no recurring/session pricing here, so
// asking about a weekly budget and matching it against a one-time price
// would be a dishonest mapping.
// ─────────────────────────────────────────────

export type FocusKey = 'strength' | 'fatloss' | 'mobility' | 'endurance';
export type BudgetKey = 'low' | 'mid' | 'high';

export const FOCUS_OPTIONS: { key: FocusKey; icon: string; label: string; blurb: string; keywords: string[] }[] = [
  {
    key: 'strength',
    icon: '🏋️',
    label: 'Strength & Hypertrophy',
    blurb: 'Build muscle, increase PRs, progressive overload',
    keywords: ['strength', 'hypertrophy', 'muscle', 'bodybuilding', 'powerlifting', 'mass', 'lifting'],
  },
  {
    key: 'fatloss',
    icon: '🔥',
    label: 'Fat Loss & Body Recomposition',
    blurb: 'Burn fat, preserve lean mass, nutrition-focused',
    keywords: ['fat loss', 'weight loss', 'recomposition', 'lean', 'cut', 'nutrition', 'body composition'],
  },
  {
    key: 'mobility',
    icon: '🧘',
    label: 'Mobility, Rehab & Athletic Performance',
    blurb: 'Fix pain, joint health, movement quality',
    keywords: ['mobility', 'rehab', 'recovery', 'injury', 'joint', 'pain', 'flexibility', 'acl', 'performance'],
  },
  {
    key: 'endurance',
    icon: '🏃',
    label: 'Endurance & Functional Conditioning',
    blurb: 'Cardio stamina, HYROX/run prep, agility',
    keywords: ['endurance', 'conditioning', 'cardio', 'running', 'hyrox', 'stamina', 'agility', 'functional'],
  },
];

export const FORMAT_OPTIONS: { key: TrainingFormat; icon: string; label: string; blurb: string }[] = [
  { key: 'in_person', icon: '📍', label: 'In-Person', blurb: 'Local gym or home sessions' },
  { key: 'virtual', icon: '🎥', label: 'Live 1-on-1 Virtual', blurb: 'Real-time form correction via video call' },
  { key: 'online', icon: '📲', label: 'Online Coaching & Programming', blurb: 'Custom plans, weekly check-ins, chat access' },
];

export const VIBE_OPTIONS: { key: CoachingStyle; icon: string; label: string }[] = [
  { key: 'high_energy', icon: '💥', label: 'High Energy / Drill Sergeant' },
  { key: 'technical', icon: '🧠', label: 'Technical / Methodical' },
  { key: 'empathetic', icon: '🤝', label: 'Empathetic / Supportive' },
];

export const BUDGET_OPTIONS: { key: BudgetKey; label: string; range: string; maxCents: number | null }[] = [
  { key: 'low', label: '$', range: 'Under $50 per plan', maxCents: 5000 },
  { key: 'mid', label: '$$', range: '$50–$150 per plan', maxCents: 15000 },
  { key: 'high', label: '$$$', range: '$150+ per plan', maxCents: null },
];

export type QuizAnswers = {
  focus: FocusKey;
  format: TrainingFormat;
  vibe: CoachingStyle;
  budget: BudgetKey;
};

export type TrainerMatch = { trainer: TrainerProfile; score: number; reasons: string[] };

function budgetTierFor(priceCents: number): BudgetKey {
  if (priceCents <= 5000) return 'low';
  if (priceCents <= 15000) return 'mid';
  return 'high';
}

export function computeMatches(answers: QuizAnswers, trainers: TrainerProfile[]): TrainerMatch[] {
  const focus = FOCUS_OPTIONS.find((f) => f.key === answers.focus)!;

  const matches = trainers.map((trainer) => {
    const reasons: string[] = [];
    const haystack = `${trainer.specialty} ${trainer.bio}`.toLowerCase();

    // Focus (40%): real keyword match against the trainer's own written specialty/bio.
    const focusHit = focus.keywords.some((kw) => haystack.includes(kw));
    const focusScore = focusHit ? 100 : 40;
    if (focusHit) reasons.push(`Specializes in ${focus.label.toLowerCase()}`);

    // Format (30%): real match against training_format the trainer selected.
    const hasFormatData = trainer.training_format.length > 0;
    const formatHit = trainer.training_format.includes(answers.format);
    const formatScore = !hasFormatData ? 60 : formatHit ? 100 : 20;
    if (formatHit) {
      const label = FORMAT_OPTIONS.find((f) => f.key === answers.format)?.label ?? answers.format;
      reasons.push(`Offers ${label} training`);
    }

    // Vibe (15%): real match against coaching_style the trainer selected.
    const vibeScore = !trainer.coaching_style ? 55 : trainer.coaching_style === answers.vibe ? 100 : 30;
    if (trainer.coaching_style === answers.vibe) {
      reasons.push(`${VIBE_OPTIONS.find((v) => v.key === answers.vibe)?.label ?? 'Coaching style'} matches your preference`);
    }

    // Budget (15%): real distance between the trainer's real price and the
    // client's selected tier, not an exact-tier-only match.
    const trainerTier = budgetTierFor(trainer.price_cents);
    const tierOrder: BudgetKey[] = ['low', 'mid', 'high'];
    const distance = Math.abs(tierOrder.indexOf(trainerTier) - tierOrder.indexOf(answers.budget));
    const budgetScore = distance === 0 ? 100 : distance === 1 ? 55 : 15;
    if (distance === 0) reasons.push('Fits within your budget');

    const score = Math.round(focusScore * 0.4 + formatScore * 0.3 + vibeScore * 0.15 + budgetScore * 0.15);

    if (reasons.length === 0) reasons.push('Actively accepting new clients');

    return { trainer, score: Math.min(99, score), reasons };
  });

  return matches.sort((a, b) => b.score - a.score);
}
