-- Optional sample data so you have something to look at.
-- Run this in the Supabase SQL Editor. Safe to run multiple times (each run adds new rows);
-- delete rows from the Table Editor if you want to start over.

insert into exercises (name, instructions, benefits, muscle_groups, equipment, category) values
(
  'Push-Up',
  'Start in a plank position with hands under shoulders. Lower your chest to the floor, keeping your body straight, then push back up.',
  'Builds upper body and core strength with no equipment needed.',
  array['chest', 'triceps', 'shoulders', 'core'],
  array[]::text[],
  'home'
),
(
  'Bodyweight Squat',
  'Stand with feet shoulder-width apart. Lower your hips back and down as if sitting in a chair, then stand back up.',
  'Strengthens legs and glutes and improves mobility.',
  array['quadriceps', 'glutes', 'hamstrings'],
  array[]::text[],
  'home'
),
(
  'Running',
  'Maintain a steady pace on a flat surface, landing mid-foot and keeping your posture upright.',
  'Improves cardiovascular endurance and burns calories.',
  array['legs', 'cardiovascular system'],
  array['running shoes'],
  'outdoor'
),
(
  'Pull-Up',
  'Hang from a bar with palms facing away from you. Pull your chin above the bar, then lower back down with control.',
  'Builds back and arm strength.',
  array['back', 'biceps', 'shoulders'],
  array['pull-up bar'],
  'outdoor'
),
(
  'Bench Press',
  'Lie on a bench, lower the barbell to your chest with control, then press it back up to full arm extension.',
  'Builds chest, shoulder, and tricep strength.',
  array['chest', 'triceps', 'shoulders'],
  array['barbell', 'bench'],
  'gym'
),
(
  'Deadlift',
  'Stand with feet hip-width apart, grip the barbell, and lift by driving through your heels and extending your hips, keeping your back straight.',
  'One of the most effective exercises for total-body strength.',
  array['back', 'hamstrings', 'glutes'],
  array['barbell'],
  'gym'
);
